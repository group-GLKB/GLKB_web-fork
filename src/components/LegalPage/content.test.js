import { createHash } from 'crypto';
import { LAST_UPDATED as POLICY_UPDATED, POLICY } from '../PrivacyPolicy/policy';
import { LAST_UPDATED as TERMS_UPDATED, TERMS, TERMS_TITLE, TERMS_SUBTITLE } from '../TermsOfService/terms';

// Verified paragraph-by-paragraph against the supplied 2027-170 v3 DOCX files.
// Only whitespace and the existing < admin@glkb.org > display normalization differ.
// These fingerprints include the heading/list classification as well as every word.
it.each([
    ['Privacy Policy', [POLICY_UPDATED], POLICY, 45,
        'fc22d18a466030e7440b3da060897bd8081d01efb727a9d625ae05ca3cfadc6d'],
    ['Terms of Service', [TERMS_TITLE, TERMS_SUBTITLE, TERMS_UPDATED], TERMS, 57,
        '2deecc4443544b133a3c181f16dd8fc9efc3c93cfd1752d27ac6991d9981ecfe'],
])('%s preserves the verified source text and block structure', (_name, headers, blocks, count, hash) => {
    expect(headers.length + blocks.length).toBe(count);
    expect(createHash('sha256').update(JSON.stringify({ headers, blocks })).digest('hex')).toBe(hash);
    blocks.forEach(([kind, text]) => {
        expect(['h', 'p', 'li', 'li2']).toContain(kind);
        expect(text.trim()).toBeTruthy();
    });
});

it('uses the dates and identifier in the documents rather than the deployment date', () => {
    expect(TERMS_TITLE).toBe('Terms of Service');
    expect(TERMS_SUBTITLE).toBe('University of Michigan Innovation Partnerships File: 2027-170');
    expect(TERMS_UPDATED).toBe('Date last updated: September 17, 2026');
    expect(POLICY_UPDATED).toBe('Last Updated July 15, 2026');
});
