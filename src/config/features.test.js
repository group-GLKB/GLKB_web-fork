/**
 * The production switch for Literature Review is a rule, not a value someone must remember to
 * flip: `production` has no line for the flag, so a master -> production merge brings master's
 * line in without a conflict, and a plain `true` would open the feature on glkb.org.
 */
import { isProductionSite, LITERATURE_REVIEW_ENABLED, PRODUCTION_HOSTS } from './features';

describe('isProductionSite', () => {
    it('is the public site, however it is spelt', () => {
        expect(PRODUCTION_HOSTS).toEqual(['glkb.org', 'www.glkb.org']);
        ['glkb.org', 'www.glkb.org', 'GLKB.org'].forEach((h) => expect(isProductionSite(h)).toBe(true));
    });

    it('is nothing else: dev, local, previews', () => {
        ['dev.glkb.org', 'localhost', '127.0.0.1', 'glkb.org.evil.example', ''].forEach(
            (h) => expect(isProductionSite(h)).toBe(false),
        );
    });
});

// On for dev and localhost again since 2026-10-10 (the redesigned review pages); off on glkb.org
// by construction. Hidden 10-03 to 10-06 and 10-09 to 10-10 — that is `false` in features.js.
it('Literature Review is on everywhere but the public site', () => {
    // jsdom's host is localhost, so the flag evaluated there is on.
    expect(LITERATURE_REVIEW_ENABLED).toBe(!isProductionSite(window.location.hostname));
    expect(LITERATURE_REVIEW_ENABLED).toBe(true);
});
