/**
 * Measure the References panel against its Figma spec.
 *
 * Source of truth: GLKB-Tokenized, "Investigate Thinking" → References panel, node 44:4561
 * (https://www.figma.com/design/ezxZxpCFzjN95UD2ZMaRqZ/GLKB-Tokenized?node-id=44-4561)
 *
 * Why a browser and not a jest test: jsdom has no layout engine, so a unit test can only assert
 * that the stylesheet *says* 24px — not that a reference row is 140px tall. Every number below is
 * read back from real layout at the design's 400px column width.
 *
 * This is a standalone script, not a playwright spec: it renders scoped.css directly and needs
 * neither a dev server nor the e2e auth fixture.
 *
 *   node e2e/scripts/measure-references-panel.mjs [--screenshot out.png]
 *
 * Exits non-zero on any mismatch. If Chromium is not where playwright expects it, point
 * CHROME_BIN at a chrome/chrome-headless-shell binary.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// The stylesheets reference design tokens, so the shell has to carry the same
// :root layer the app loads through index.css or every colour resolves to its
// initial value and the colour checks below measure nothing.
const TOKENS_CSS = fs.readFileSync(path.join(ROOT, 'src/styles/tokens.css'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'src/components/LLMAgent/scoped.css'), 'utf8');

const shotFlag = process.argv.indexOf('--screenshot');
const SHOT = shotFlag >= 0 ? process.argv[shotFlag + 1] : null;

// The panel as index.jsx renders it. MUI's own base rules are inlined because scoped.css only
// *overrides* MUI — without them the script would measure a browser default that never ships.
const HTML = `<!doctype html><html><head><style>
${TOKENS_CSS}
*{box-sizing:border-box} body{margin:0;font-family:Geist,sans-serif}
.MuiIconButton-root{display:inline-flex;align-items:center;justify-content:center;border:0;margin:0;background:transparent;flex:0 0 auto}
.MuiToggleButtonGroup-root{display:inline-flex;border-radius:4px}
.MuiToggleButton-root{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;background:transparent;border:1px solid rgba(0,0,0,.12);white-space:nowrap}
${CSS}
</style></head><body>
<div class="llm-column references-column" style="width:400px;height:900px">
  <div style="height:100%;width:100%">
    <div class="references-container">
      <div class="references-header-row">
        <div class="references-header-main">
          <h3 class="references-title">References</h3>
          <button class="references-scope-trigger">
            <span class="material-symbols-outlined references-scope-icon"></span>
            <span>Select a response</span>
            <span class="references-scope-chevron"></span>
          </button>
        </div>
      </div>
      <div class="references-toolbar-row">
        <span class="references-count-label">21 Citations</span>
        <div class="references-toolbar-actions">
          <button class="references-action-button MuiIconButton-root"><span style="width:14px;height:14px;display:block;background:#5E6E87"></span></button>
          <div class="references-sort-toggle MuiToggleButtonGroup-root">
            <button class="MuiToggleButton-root Mui-selected">Citation</button>
            <button class="MuiToggleButton-root">Year</button>
          </div>
        </div>
      </div>
      <div class="references-list ref-skeleton">
        ${Array.from({ length: 6 }).map(() => `<div class="ref-skeleton-card">
          ${Array.from({ length: 5 }).map(() => '<span class="ref-skeleton-bar"></span>').join('')}
        </div>`).join('')}
      </div>
    </div>
  </div>
</div>
</body></html>`;

// [selector, dimension, expected, label] — straight off the Figma node.
const SPEC = [
    ['.references-column', 'width', 400, 'panel column'],
    ['.references-container', 'width', 384, 'card (400 - 16 right inset)'],
    ['.references-header-row', 'height', 60, 'header row'],
    ['.references-toolbar-row', 'height', 38, 'citations/sort row'],
    ['.ref-skeleton-card', 'height', 140, 'reference row'],
    ['.ref-skeleton-bar', 'height', 12, 'skeleton bar'],
    ['.references-action-button', 'width', 22, 'export button'],
    ['.references-action-button', 'height', 22, 'export button'],
    ['.references-sort-toggle', 'height', 22, 'sort toggle group'],
    ['.references-sort-toggle .MuiToggleButton-root', 'height', 20, 'sort segment'],
    ['.references-action-button > span', 'width', 14, 'export glyph'],
];

const browser = await chromium.launch(
    process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {},
);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.setContent(HTML);

const got = await page.evaluate((spec) => {
    const round = (n) => Math.round(n * 100) / 100;
    const out = spec.map(([sel, prop]) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return round(prop === 'width' ? r.width : r.height);
    });
    const bars = [...document.querySelectorAll('.ref-skeleton-card:first-child .ref-skeleton-bar')]
        .map((b) => round(b.getBoundingClientRect().width));
    const card = document.querySelector('.references-container').getBoundingClientRect();
    const row = document.querySelector('.ref-skeleton-card').getBoundingClientRect();
    const bar = document.querySelector('.ref-skeleton-bar').getBoundingClientRect();
    return {
        out,
        bars,
        gutterLeft: round(row.left - card.left),
        rowWidth: round(row.width),
        // Asserted because the numeric checks alone once passed while every bar sat 24px too far
        // right: `.references-list>div` also matches a skeleton card and added its own padding.
        barLeft: round(bar.left - card.left),
    };
}, SPEC.map(([s, p]) => [s, p]));

if (SHOT) await page.screenshot({ path: SHOT, clip: { x: 0, y: 0, width: 400, height: 900 } });
await browser.close();

let fail = 0;
const check = (ok, label, want, have) => {
    if (!ok) fail += 1;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(28)} want ${String(want).padStart(16)}  got ${have}`);
};

console.log('References panel vs Figma 44:4561, measured in Chromium at the 400px design width\n');
SPEC.forEach(([, prop, want, label], i) => {
    check(got.out[i] === want, `${label} (${prop})`, want, got.out[i]);
});
const wantBars = [80, 232, 200, 180, 160];
check(JSON.stringify(got.bars) === JSON.stringify(wantBars), 'skeleton bar widths',
    wantBars.join('/'), got.bars.join('/'));
check(got.gutterLeft === 24, 'list gutter (space/6)', 24, got.gutterLeft);
check(got.rowWidth === 336, 'reference row width', 336, got.rowWidth);
check(got.barLeft === 24, 'bar offset from card edge', 24, got.barLeft);

console.log(`\n${fail === 0 ? 'ALL MATCH the Figma spec' : `${fail} MISMATCH(ES)`}`);
process.exit(fail === 0 ? 0 : 1);
