import { refusalNeedsSignIn, refusalText } from './refusals';

describe('refusalText', () => {
    it("uses the backend's message and adds the cheaper choice it found", () => {
        expect(refusalText({
            code: 'INSUFFICIENT_CREDITS',
            message: 'Not enough credits. This query requires 45 credits. You currently have 30 credits remaining.',
            cheaper_option: { pipeline: 'deep_research', service_tier: 'standard', credits: 20 },
        })).toBe('Not enough credits. This query requires 45 credits. You currently have 30 credits remaining.'
            + ' Switch to Standard Investigate to continue with 20 credits.');
    });

    it('says nothing about a cheaper choice when there is none', () => {
        expect(refusalText({ code: 'INSUFFICIENT_CREDITS', message: 'Not enough credits.', cheaper_option: null }))
            .toBe('Not enough credits.');
    });

    it('falls back to its own sentence when the backend sent none', () => {
        expect(refusalText({ code: 'GUEST_LIMIT_REACHED' })).toBe('Please sign in to continue.');
        expect(refusalText({ code: null, status: 400 })).toBe('This request could not be started.');
        expect(refusalText(null)).toBe('');
    });
});

it('only a guest refusal is answered by signing in', () => {
    expect(refusalNeedsSignIn({ code: 'GUEST_LIMIT_REACHED' })).toBe(true);
    expect(refusalNeedsSignIn({ code: 'GUEST_LOGIN_REQUIRED' })).toBe(true);
    expect(refusalNeedsSignIn({ code: 'INSUFFICIENT_CREDITS' })).toBe(false);
});
