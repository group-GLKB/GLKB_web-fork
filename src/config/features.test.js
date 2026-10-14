/**
 * `production` has no line for the Literature Review flag, so a master -> production merge brings
 * master's line in without a conflict: what master says is what glkb.org gets.
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

// Launched on glkb.org 2026-10-14. Before that: on for dev and localhost only from 10-10 (the
// redesigned review pages), hidden 10-03 to 10-06 and 10-09 to 10-10.
it('Literature Review is on everywhere, the public site included', () => {
    expect(LITERATURE_REVIEW_ENABLED).toBe(true);
});
