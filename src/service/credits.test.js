import {
    applyStreamCredits,
    getUsageSnapshot,
    limitReachedText,
    parseCredits,
    parseGuestUsage,
    parseUtc,
} from './credits';
import axios from '../utils/axiosConfig';
import { fetchUsage } from './credits';

jest.mock('../utils/axiosConfig', () => ({ __esModule: true, default: { get: jest.fn() } }));

it('reads a UTC timestamp that carries no Z as UTC', () => {
    expect(parseUtc('2026-11-01T00:00:00').toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(parseUtc('2026-11-01T00:00:00Z').toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(parseUtc('')).toBeNull();
});

describe('a signed-in reader', () => {
    it('is out once fewer than one credit is left', () => {
        expect(parseCredits({ remaining: 1, monthly_allowance: 100 }).limitReached).toBe(false);
        expect(parseCredits({ remaining: 0, monthly_allowance: 100 }).limitReached).toBe(true);
    });

    it("folds a stream frame's balance in", async () => {
        axios.get.mockResolvedValueOnce({ data: { remaining: 5, monthly_allowance: 100, resets_at: '2026-11-01T00:00:00' } });
        await fetchUsage({ isAuthenticated: true });
        expect(axios.get).toHaveBeenCalledWith('/api/v1/credits/me');
        expect(applyStreamCredits({ charged: 1, remaining: 4 })).toBe(true);
        expect(getUsageSnapshot().remaining).toBe(4);
        expect(applyStreamCredits({ charged: 1, remaining: null })).toBe(false);
        expect(applyStreamCredits({ refunded: 1, remaining: 0 })).toBe(true);
        expect(getUsageSnapshot().limitReached).toBe(true);
        expect(limitReachedText(getUsageSnapshot())).toMatch(/out of credits.*Nov 1/);
    });
});

describe('a guest', () => {
    it('reads the chat and Investigate counts', () => {
        const usage = parseGuestUsage({
            chat: { limit: 100, used: 100, remaining: 0 },
            deep_research: { limit: 5, used: 2, remaining: 3 },
            resets_at: '2026-11-01T00:00:00',
        });
        expect(usage).toMatchObject({ kind: 'guest', limit: 100, remaining: 0, investigateRemaining: 3, limitReached: true });
        expect(limitReachedText(usage)).toMatch(/100 free questions this month\. Sign in/);
    });

    it('reads a backend from before guest mode reopened', () => {
        expect(parseGuestUsage({ quota_limit: 500, quota_remaining: 12 })).toMatchObject({ limit: 500, remaining: 12, limitReached: false });
    });

    it('a stream frame never turns a guest status into a credit balance', async () => {
        axios.get.mockResolvedValueOnce({ data: { chat: { limit: 100, remaining: 50 } } });
        await fetchUsage({ isAuthenticated: false });
        expect(axios.get).toHaveBeenCalledWith('/api/v1/tier/guest-me');
        expect(applyStreamCredits({ remaining: 3 })).toBe(false);
        expect(getUsageSnapshot().kind).toBe('guest');
    });
});
