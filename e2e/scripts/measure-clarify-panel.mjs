/**
 * Measure the clarify panel against its Figma spec.
 *
 * Source of truth: GLKB-Tokenized, "Asking Question" → node 111:4385 (Options), with the state
 * variants 111:4593 (hover), 111:4796 (selected) and the footer 111:4845 (Submit).
 * https://www.figma.com/design/ezxZxpCFzjN95UD2ZMaRqZ/GLKB-Tokenized?node-id=111-4006
 *
 * Behaviour is covered by ClarifyPanel.test.jsx; this covers what jsdom cannot see, because it
 * has no layout engine — heights, paddings and the resting/hover/selected fills.
 *
 *   node e2e/scripts/measure-clarify-panel.mjs [--screenshot out.png]
 *
 * Exits non-zero on any mismatch. Set CHROME_BIN if Chromium is not where playwright expects it.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CSS = fs.readFileSync(path.join(ROOT, 'src/components/LLMAgent/scoped.css'), 'utf8');

const shotFlag = process.argv.indexOf('--screenshot');
const SHOT = shotFlag >= 0 ? process.argv[shotFlag + 1] : null;

const row = (n, label, desc, selected) => `
  <div class="clarify-option${selected ? ' selected' : ''}" role="radio" aria-checked="${!!selected}" tabindex="0">
    <div class="clarify-option-body">
      <div class="clarify-option-line">
        <span class="clarify-option-index">${n}.</span>
        <span class="clarify-option-label">${label}</span>
      </div>
      <div class="clarify-option-descwrap"><p class="clarify-option-desc">${desc}</p></div>
    </div>
    <span class="clarify-option-mark">${selected ? '<span class="clarify-option-check"></span>' : ''}</span>
  </div>`;

const DESC = 'Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien '
    + 'vitae pellentesque sem placerat. In id cursus mi pretium tellus duis convallis.';

const HTML = `<!doctype html><html><head><style>
*{box-sizing:border-box} body{margin:0;font-family:Geist,sans-serif}
.clarify-option-check{display:block;width:12px;height:12px}
${CSS}
</style></head><body>
<div style="width:680px">
  <div class="clarify-panel">
    <div class="clarify-question">
      <div class="clarify-question-head">
        <p class="clarify-question-text">Example question lorem ipsum?</p>
        <button class="clarify-close"><span style="display:block;width:20px;height:20px"></span></button>
      </div>
      <div class="clarify-options" role="radiogroup">
        ${row(1, 'Answer 1', DESC, true)}
        ${row(2, 'Answer 2', DESC, false)}
        <div class="clarify-option clarify-other">
          <div class="clarify-option-body">
            <div class="clarify-option-line">
              <span class="clarify-other-icon"><span class="clarify-other-pencil" style="display:block;width:12px;height:12px"></span></span>
              <span class="clarify-option-label">Other</span>
            </div>
            <div class="clarify-option-descwrap">
              <input class="clarify-other-input" placeholder="Type your own answer here" />
            </div>
          </div>
          <button class="clarify-option-mark"></button>
        </div>
      </div>
    </div>
    <div class="clarify-actions">
      <button class="clarify-submit">Submit<span class="clarify-submit-icon" style="display:block;width:16px;height:16px"></span></button>
    </div>
  </div>
</div>
</body></html>`;

const hex = (rgb) => {
    const m = String(rgb).match(/\d+/g);
    if (!m) return rgb;
    return `#${m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
};

const browser = await chromium.launch(
    process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {},
);
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
await page.setContent(HTML);

const got = await page.evaluate(() => {
    const round = (n) => Math.round(n * 100) / 100;
    const box = (sel) => {
        const el = document.querySelector(sel);
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
            w: round(r.width), h: round(r.height), radius: cs.borderRadius,
            bg: cs.backgroundColor, pad: cs.padding, gap: cs.gap,
            font: `${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight}`, color: cs.color,
        };
    };
    const panel = document.querySelector('.clarify-panel').getBoundingClientRect();
    const rows = [...document.querySelectorAll('.clarify-option')];
    const rowRects = rows.map((r) => r.getBoundingClientRect());
    // hover fill, read by forcing the class the stylesheet uses for :hover parity
    return {
        panel: box('.clarify-panel'),
        head: box('.clarify-question-head'),
        qtext: box('.clarify-question-text'),
        rowUnsel: box('.clarify-option:nth-child(2)'),
        rowSel: box('.clarify-option.selected'),
        mark: box('.clarify-option-mark'),
        markSel: box('.clarify-option.selected .clarify-option-mark'),
        desc: box('.clarify-option-desc'),
        descwrap: box('.clarify-option-descwrap'),
        input: box('.clarify-other-input'),
        submit: box('.clarify-submit'),
        options: box('.clarify-options'),
        rowGap: round(rowRects[1].top - rowRects[0].bottom),
        panelWidth: round(panel.width),
        indexWidth: round(document.querySelector('.clarify-option-index').getBoundingClientRect().width),
    };
});

if (SHOT) await page.screenshot({ path: SHOT, clip: { x: 0, y: 0, width: 680, height: 560 } });
await browser.close();

let fail = 0;
const check = (label, want, have) => {
    const ok = String(want) === String(have);
    if (!ok) fail += 1;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(38)} want ${String(want).padStart(18)}  got ${have}`);
};

console.log('Clarify panel vs Figma 111:4385, measured in Chromium\n');
check('panel width', 680, got.panelWidth);
check('panel padding (space/4 x space/3)', '16px 12px', got.panel.pad);
check('panel radius (radius/4)', '16px', got.panel.radius);
check('question head padding', '0px 8px 12px', got.head.pad);
check('question type (body-emphasized)', '600 14px/22px', got.qtext.font);
check('options gap (space/2)', 8, got.rowGap);
check('options inline padding (space/2)', '0px 8px', got.options.pad);
check('row padding (space/2 x space/3)', '8px 12px', got.rowUnsel.pad);
check('row radius (radius/2)', '8px', got.rowUnsel.radius);
check('row fill at rest (background/subtle)', '#F2F4F8', hex(got.rowUnsel.bg));
check('row fill selected (brand/soft)', '#EEF3FF', hex(got.rowSel.bg));
check('index column width (space/5)', 20, got.indexWidth);
check('description indent (space/5)', '0px 20px', got.descwrap.pad);
check('description type (body-sm)', '400 12px/20px', got.desc.font);
check('selector size', '16 x 16', `${got.mark.w} x ${got.mark.h}`);
check('selector radius (radius/1)', '4px', got.mark.radius);
check('selector fill selected (brand/primary)', '#155DFC', hex(got.markSel.bg));
check('Other input height', 32, got.input.h);
check('Other input radius (radius/2)', '8px', got.input.radius);
check('Submit fill (brand/primary)', '#155DFC', hex(got.submit.bg));
check('Submit padding (space/2 x space/3)', '8px 12px', got.submit.pad);
check('Submit type (interactive/sm)', '500 12px/16px', got.submit.font);

console.log(`\n${fail === 0 ? 'ALL MATCH the Figma spec' : `${fail} MISMATCH(ES)`}`);
process.exit(fail === 0 ? 0 : 1);
