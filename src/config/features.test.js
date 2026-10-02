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

it('Literature Review is on off the production site (jsdom runs on localhost)', () => {
    expect(window.location.hostname).toBe('localhost');
    expect(LITERATURE_REVIEW_ENABLED).toBe(true);
});
