/**
 * Prices per effort level (the three-repo effort contract, 2026-11-05): `GET /credits/pricing`
 * adds an `efforts` block, and High costs more than Medium on the same model. Without the block
 * (a backend that predates it) every price is the pipeline's, as before.
 */
import { affordableChoice, parseCredits } from '../../../service/credits';
import {
    creditsForEffort,
    FALLBACK_PRICING,
    parseEfforts,
    parsePricing,
} from '../../../service/serviceTiers';
import { investigatePriceText } from '../../LLMAgent/SearchLimitNotice';
import { noticeFor } from '.';

jest.mock('../../../utils/axiosConfig', () => ({ __esModule: true, default: { get: jest.fn() } }));

const EFFORTS = [
    { id: 'low', pipeline: 'chat', enabled: true, guest: true, default: false, prices: { standard: 1, advanced: 2, premium: 5 } },
    { id: 'medium', pipeline: 'chat', enabled: true, guest: true, default: true, prices: { standard: 1, advanced: 5, premium: 10 } },
    { id: 'high', pipeline: 'chat', enabled: true, guest: false, default: false, prices: { standard: 3, advanced: 10, premium: 20 } },
    { id: 'extra', pipeline: 'deep_research', enabled: true, guest: false, default: true, prices: { standard: 20, advanced: 30, premium: 45 } },
    { id: 'max', pipeline: 'deep_research', enabled: true, guest: false, default: false, prices: { standard: 40, advanced: 60, premium: 90 } },
];
const withBlock = parsePricing({ ...FALLBACK_PRICING, efforts: EFFORTS });
const without = parsePricing(FALLBACK_PRICING);

const usage = (remaining) => parseCredits({
    remaining, monthly_allowance: 100, monthly_remaining: remaining, resets_at: '2026-12-01T00:00:00',
});

describe('the efforts block', () => {
    it('is read in menu order, unknown levels dropped, each on its own pipeline', () => {
        const rows = parseEfforts({ efforts: [EFFORTS[4], { id: 'turbo', enabled: true }, EFFORTS[0], { ...EFFORTS[2], pipeline: 'deep_research' }] });
        expect(rows.map((r) => [r.id, r.pipeline, r.enabled, r.guest])).toEqual([
            ['low', 'chat', true, true], ['high', 'chat', true, false], ['max', 'deep_research', true, false],
        ]);
        expect(parseEfforts({})).toBeNull();
        expect(parseEfforts({ efforts: [] })).toBeNull();
    });

    it('gives each tier its per-level prices', () => {
        expect(withBlock.tiers.find((t) => t.id === 'advanced').effortCredits)
            .toEqual({ low: 2, medium: 5, high: 10, extra: 30, max: 60 });
        expect(without.efforts).toBeNull();
        expect(without.tiers.find((t) => t.id === 'advanced').effortCredits).toEqual({});
    });
});

describe('the price of one question', () => {
    it('is the level\'s own', () => {
        expect(creditsForEffort(withBlock, 'advanced', 'high')).toBe(10);
        expect(creditsForEffort(withBlock, 'standard', 'low')).toBe(1);
        expect(creditsForEffort(withBlock, 'premium', 'max')).toBe(90);
    });

    it('is the pipeline\'s at Medium and Extra, and for every level without the block', () => {
        expect(creditsForEffort(withBlock, 'advanced', 'medium')).toBe(5);
        expect(creditsForEffort(withBlock, 'advanced', 'extra')).toBe(30);
        expect(creditsForEffort(without, 'advanced', 'high')).toBe(5);
        expect(creditsForEffort(without, 'advanced', 'max')).toBe(30);
        expect(creditsForEffort(without, 'nope', 'high')).toBeNull();
    });

    it('is what "Ask in Investigate" and "Run a full investigation" show', () => {
        expect(investigatePriceText(withBlock, 'advanced')).toBe('30 credits');
        expect(investigatePriceText(withBlock, 'advanced', 'max')).toBe('60 credits');
        expect(investigatePriceText(without, 'advanced', 'max')).toBe('30 credits');
    });
});

describe('the credit notice at a level', () => {
    it('prices High as High, and offers a cheaper model at High first', () => {
        const notice = noticeFor(usage(6), withBlock, 'chat', 'advanced', 'high');
        expect(notice.level).toBe('short');
        expect(notice.text).toBe(
            'A High-effort question on GPT-6.1 Terra costs 10 credits and you have 6 left.'
            + ' Your free monthly credits come back on Dec 1.'
            + ' Switch to GPT-6 Luna (3 credits) to go ahead now.',
        );
        expect(notice.brief).toBe('High effort needs 10 credits · 6 left');
    });

    it('falls back to Medium when no model fits at High', () => {
        expect(affordableChoice(withBlock, 'chat', 2, 'advanced', 'high'))
            .toEqual({ tierId: 'standard', pipeline: 'chat', credits: 1 });
        expect(noticeFor(usage(2), withBlock, 'chat', 'advanced', 'high').text)
            .toContain('Medium effort on GPT-6 Luna (1 credit) still works.');
    });

    it('prices Max as Max', () => {
        const notice = noticeFor(usage(50), withBlock, 'deep_research', 'advanced', 'max');
        expect(notice.text).toMatch(/^A Max-effort Investigate run on GPT-6.1 Terra costs 60 credits and you have 50 left\./);
        expect(notice.text).toContain('Switch to GPT-6 Luna (40 credits) to go ahead now.');
    });

    it('says exactly what it said before at Medium and Extra', () => {
        expect(noticeFor(usage(10), withBlock, 'deep_research', 'advanced', 'extra'))
            .toEqual(noticeFor(usage(10), without, 'deep_research', 'advanced'));
        expect(noticeFor(usage(3), withBlock, 'chat', 'advanced', 'medium'))
            .toEqual(noticeFor(usage(3), without, 'chat', 'advanced'));
    });

    it('prices a level of the other pipeline as its pipeline, and High as chat without the block', () => {
        expect(noticeFor(usage(10), withBlock, 'deep_research', 'advanced', 'high'))
            .toEqual(noticeFor(usage(10), without, 'deep_research', 'advanced'));
        expect(noticeFor(usage(4), without, 'chat', 'advanced', 'high').text)
            .toMatch(/^A High-effort question on GPT-6.1 Terra costs 5 credits/);
    });
});
