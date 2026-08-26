/**
 * The redesigned surfaces use the token palette and nothing else.
 *
 * A hardcoded colour is not automatically wrong — the About hero draws a picture of the Chrome
 * browser, whose greys belong to Chrome rather than to us — but it is always a decision, and one
 * that should be made deliberately rather than by a copied hex drifting in. This test is the
 * place that decision gets recorded.
 *
 * Deliberately NOT covered:
 *   - Graph/nodeStyle.js, which must hold literals because Cytoscape parses the strings itself.
 *     nodeStyle.test.js already asserts every one of them still equals its token.
 *   - LLMAgent and the older Units components, which predate the design system and still carry
 *     pre-redesign colours. Adding them here would mean an allowlist longer than the rule.
 */
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..');

/** Surfaces rebuilt on the design, which should be entirely tokenised. */
const TOKENISED = [
    'components/Blog',
    'components/SiteChrome',
    'components/LegalPage',
    'components/PrivacyPolicy',
    'components/TermsOfService',
    'components/AccountPage',
    'components/History',
    'components/Library',
    'components/Layout',
];

/**
 * About is tokenised except for one thing: Figma 1088:28340 is a drawing of a Chrome window,
 * and its chrome is Chrome's, not the product's. Those colours are copied on purpose.
 */
const ABOUT_ALLOWED = {
    '#f6fafa': 'the tinted band behind the hero and the lab rail — a raw fill in the frame too',
    '#dfe1e5': 'Chrome tab strip',
    '#ed6a5e': 'Chrome close light',
    '#f4bf4f': 'Chrome minimise light',
    '#61c454': 'Chrome zoom light',
    '#3c4043': 'Chrome tab and address text',
    '#b6b6b6': 'Chrome toolbar rule',
    '#f1f3f4': 'Chrome address bar fill',
};

const HEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;

const walk = (dir) => {
    const out = [];
    const entries = fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : [];
    entries.forEach((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== '__fixtures__') out.push(...walk(full));
        } else if (/\.(css|jsx|js)$/.test(entry.name) && !entry.name.includes('.test.')) {
            out.push(full);
        }
    });
    return out;
};

const hexesIn = (file) => (fs.readFileSync(file, 'utf8').match(HEX) || [])
    .map((h) => h.toLowerCase());

describe('the redesigned surfaces are tokenised', () => {
    TOKENISED.forEach((surface) => {
        it(`${surface} names no colour of its own`, () => {
            const offenders = walk(path.join(SRC, surface))
                .map((file) => [path.relative(SRC, file), hexesIn(file)])
                .filter(([, hexes]) => hexes.length > 0)
                .map(([rel, hexes]) => `${rel}: ${[...new Set(hexes)].join(', ')}`);

            expect(offenders).toEqual([]);
        });
    });
});

describe('About', () => {
    it('names only the colours of the browser it draws', () => {
        const unexpected = walk(path.join(SRC, 'components/AboutPage'))
            .flatMap((file) => hexesIn(file).map((hex) => [path.relative(SRC, file), hex]))
            .filter(([, hex]) => !(hex in ABOUT_ALLOWED))
            .map(([rel, hex]) => `${rel}: ${hex}`);

        expect(unexpected).toEqual([]);
    });

    it('still uses every colour the allowlist excuses', () => {
        const present = new Set(
            walk(path.join(SRC, 'components/AboutPage')).flatMap(hexesIn),
        );
        // An allowlist that outlives its use is how the next hex gets waved through.
        expect(Object.keys(ABOUT_ALLOWED).filter((hex) => !present.has(hex))).toEqual([]);
    });
});
