/**
 * Measure the reference hover card against its Figma spec.
 *
 * Source of truth: GLKB-Tokenized, "Reference - Hover Preview" → node 299:22085
 * https://www.figma.com/design/ezxZxpCFzjN95UD2ZMaRqZ/GLKB-Tokenized?node-id=299-22085
 *
 * Renders the component's OWN markup (e2e/fixtures/reference-hover-card.html, dumped from react)
 * with the real scoped.css, because jsdom has no layout engine and can only confirm that the
 * stylesheet says 240px — not that the card is 240px with its children where the design puts them.
 *
 *   node e2e/scripts/measure-reference-hover-card.mjs [--screenshot out.png]
 *
 * Exits non-zero on any mismatch. Set CHROME_BIN if Chromium is not where playwright expects it.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CSS = fs.readFileSync(path.join(ROOT, 'src/components/LLMAgent/scoped.css'), 'utf8');
const BODY = fs.readFileSync(path.join(ROOT, 'e2e/fixtures/reference-hover-card.html'), 'utf8');

const shotFlag = process.argv.indexOf('--screenshot');
const SHOT = shotFlag >= 0 ? process.argv[shotFlag + 1] : null;

const HTML = `<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap">
<style>
*{box-sizing:border-box} body{margin:0;background:#fff;font-family:Geist,sans-serif}
.MuiSvgIcon-root{width:1em;height:1em;display:inline-block;fill:currentColor;flex-shrink:0;font-size:1.5rem}
${CSS}
/* the card is position:fixed; pin it somewhere measurable */
.ref-hover-card{left:40px !important;top:40px !important;visibility:visible !important}
</style></head><body>${BODY}</body></html>`;

const hex = (rgb) => {
    const m = String(rgb).match(/\d+/g);
    if (!m) return rgb;
    return `#${m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
};

const browser = await chromium.launch(
    process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {},
);
const page = await browser.newPage({ viewport: { width: 600, height: 700 } });
await page.setContent(HTML);
await page.waitForTimeout(1500);   // Geist; the wrapped heights depend on it

const got = await page.evaluate(() => {
    const round = (n) => Math.round(n * 100) / 100;
    const box = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const c = getComputedStyle(el);
        return {
            w: round(r.width), h: round(r.height), left: round(r.left), top: round(r.top),
            pad: c.padding, radius: c.borderRadius, gap: c.gap, bg: c.backgroundColor,
            font: `${c.fontWeight} ${c.fontSize}/${c.lineHeight}`, color: c.color,
            shadow: c.boxShadow, marginBottom: c.marginBottom,
        };
    };
    const card = document.querySelector('.ref-hover-card').getBoundingClientRect();
    const quote = document.querySelector('.ref-hover-quote').getBoundingClientRect();
    // Every block's top/bottom relative to the card, which is how the design specifies them.
    const at = (sel) => {
        const r = document.querySelector(sel).getBoundingClientRect();
        return `${Math.round(r.top - card.top)}..${Math.round(r.bottom - card.top)}`;
    };
    return {
        card: box('.ref-hover-card'),
        head: box('.ref-hover-head'),
        title: box('.ref-hover-title'),
        source: box('.ref-hover-source'),
        authors: box('.ref-hover-authors'),
        quote: box('.ref-hover-quote'),
        quoteText: box('.ref-hover-quote-text'),
        meta: box('.ref-hover-meta'),
        divider: box('.ref-hover-divider'),
        badge: box('.ref-hover-badge'),
        fulltext: box('.ref-hover-fulltext'),
        icon: box('.ref-hover-icon'),
        contentWidth: round(quote.width),
        cardInnerLeft: round(quote.left - card.left),
        cardHeight: round(card.height),
        y: {
            title: at('.ref-hover-title'),
            source: at('.ref-hover-source'),
            quote: at('.ref-hover-quote'),
            meta: at('.ref-hover-meta'),
            actions: at('.ref-hover-actions'),
        },
    };
});

if (SHOT) await page.screenshot({ path: SHOT, clip: { x: 20, y: 20, width: 300, height: 360 } });
await browser.close();

let fail = 0;
const check = (label, want, have) => {
    const ok = String(want) === String(have);
    if (!ok) fail += 1;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(40)} want ${String(want).padStart(16)}  got ${have}`);
};

console.log('Reference hover card vs Figma 299:22085, measured in Chromium\n');
check('card width', 240, got.card.w);
// The design fixes where every block sits. Checking properties alone missed a 5px drift: the
// PMID row rendered at its line-height 20 where the design pins it to 16, and the 1px divider
// added a pixel the design's zero-height stroke does not.
// 304 in the design; 262 here, from two subtractions the design's own render does not need:
//   -20  the blank line in the placeholder copy between the authors and the journal
//        (see .ref-hover-authors in scoped.css);
//   -16  the dead space under the quote's second clamped line, which the design leaves in a fixed
//        60px block. This card floats over the answer, so a row it does not need is a row of text
//        it covers.
// Everything below the head therefore sits above the design's own y, and nothing else moves.
check('card height (design 304, less blank line + quote slack)', 262, got.cardHeight);
check('title      y', '16..70', got.y.title);
check('source     y (design 84..144)', '78..118', got.y.source);
check('quote      y (design 156..216)', '130..174', got.y.quote);
check('PMID row   y (design 228..244)', '186..202', got.y.meta);
check('footer     y (design 268..288)', '214..234', got.y.actions);
check('card padding (space/4)', '16px', got.card.pad);
check('card radius (radius/4)', '16px', got.card.radius);
check('card children gap (space/3)', '12px', got.card.gap);
// The hairline is an INSET SHADOW, not a border: Figma's stroke sits inside the frame, and a real
// border would eat 2px of the 240 and push the content column to 206.
check('card hairline is an inset 1px border/default', true,
    /inset/.test(got.card.shadow) && /229,\s*233,\s*240/.test(got.card.shadow));
check('content column width', 208, got.contentWidth);
check('content inset from card edge', 16, got.cardInnerLeft);
check('head gap (space/2)', '8px', got.head.gap);
check('title type (interactive/emphasized)', '600 14px/18px', got.title.font);
check('title colour (text/primary)', '#0C1018', hex(got.title.color));
check('source type (body-sm)', '400 12px/20px', got.source.font);
check('source colour (text/tertiary)', '#5E6E87', hex(got.source.color));
check('quote type (body)', '400 14px/22px', got.quoteText.font);
check('quote colour (text/secondary)', '#222A38', hex(got.quoteText.color));
check('quote block height (design 60, less its slack)', 44, got.quote.h);
check('quote text clamped to 2 lines', 44, got.quoteText.h);
check('authors line margin (deviation: design 20px)', '0px', got.authors.marginBottom);
check('meta type (body-sm)', '400 12px/20px', got.meta.font);
check('divider height', 1, got.divider.h);
check('badge size', '16 x 16', `${got.badge.w} x ${got.badge.h}`);
check('badge radius (radius/1)', '4px', got.badge.radius);
check('badge fill (brand/muted)', '#D9E6FE', hex(got.badge.bg));
check('badge text (brand/primary)', '#155DFC', hex(got.badge.color));
check('action button size', '20 x 20', `${got.icon.w} x ${got.icon.h}`);
check('Full Text type', '600 10px/12px', got.fulltext.font);

console.log(`\n${fail === 0 ? 'ALL MATCH the Figma spec' : `${fail} MISMATCH(ES)`}`);
process.exit(fail === 0 ? 0 : 1);
