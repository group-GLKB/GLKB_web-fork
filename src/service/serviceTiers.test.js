/**
 * The tier a request carries, and the fallback pricing (service/serviceTiers.js).
 */
jest.mock('../utils/axiosConfig', () => ({ get: jest.fn() }));

// eslint-disable-next-line import/first
import {
    effectiveTier,
    FALLBACK_PRICING,
    GUEST_TIER,
    isGuestTier,
    parsePricing,
    tiersFor,
} from './serviceTiers';

describe('effectiveTier', () => {
    it('sends a signed-in reader whatever they chose', () => {
        expect(effectiveTier(' Premium ')).toBe('premium');
        expect(effectiveTier('')).toBe('');
    });

    it('lets a guest use Terra or Luna', () => {
        expect(effectiveTier('advanced', { isGuest: true })).toBe('advanced');
        expect(effectiveTier('standard', { isGuest: true })).toBe('standard');
    });

    it('puts a guest on Terra for Premium or no choice', () => {
        expect(GUEST_TIER).toBe('advanced');
        expect(effectiveTier('premium', { isGuest: true })).toBe('advanced');
        expect(effectiveTier('', { isGuest: true })).toBe('advanced');
        expect(isGuestTier('premium')).toBe(false);
    });
});

describe('the fallback pricing', () => {
    it('offers all three tiers with Terra as the default', () => {
        const pricing = parsePricing(FALLBACK_PRICING);
        expect(pricing.defaultTier).toBe('advanced');
        expect(pricing.tiers.map((t) => [t.id, t.label])).toEqual([
            ['premium', 'GPT-6.1 Sol'], ['advanced', 'GPT-6.1 Terra'], ['standard', 'GPT-6 Luna'],
        ]);
        expect(pricing.tiers.find((t) => t.id === 'advanced').credits)
            .toEqual({ chat: 5, deep_research: 30, literature_review: 20 });
        expect(tiersFor(pricing, 'literature_review').defaultTier).toBe('advanced');
    });
});
