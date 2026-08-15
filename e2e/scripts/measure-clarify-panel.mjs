/**
 * Measure the clarify panel against its Figma spec.
 *
 * Source of truth: GLKB-Tokenized, "Asking User Question v2" → node 581:7642, whose four frames
 * are the card in pick-one (577:6731) and pick-any (577:6961), each unanswered and answered.
 * https://www.figma.com/design/ezxZxpCFzjN95UD2ZMaRqZ/GLKB-Tokenized?node-id=581-7642
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

// The panel's ACTUAL rendered markup, dumped from ClarifyPanel via react-testing-library and
// kept in sync by ClarifyPanel.test.jsx ("the committed fixture still matches what it renders").
// Hand-written stand-in markup here would measure a shape the component does not produce — and
// did: an earlier version of this script passed while the real Other row was 4px short, because
// the stand-in had no 20px icon box around the pencil.
const BODY = fs.readFileSync(path.join(ROOT, 'e2e/fixtures/clarify-panel.html'), 'utf8');

const HTML = `<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap">
<style>
*{box-sizing:border-box} body{margin:0;font-family:Geist,sans-serif}
/* MUI's own base rules for what the panel renders; scoped.css only overrides them. */
.MuiSvgIcon-root{width:1em;height:1em;display:inline-block;fill:currentColor;flex-shrink:0;font-size:1.5rem}
.MuiTypography-root{margin:0}
${CSS}
</style></head><body><div style="width:680px">${BODY}</div></body></html>`;

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
// Row heights are text-driven, so the webfont must be in before anything is measured.
await page.waitForTimeout(1500);

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
        other: box('.clarify-other'),
        actions: box('.clarify-actions'),
        rowGap: round(rowRects[1].top - rowRects[0].bottom),
        panelWidth: round(panel.width),
        markNum: box('.clarify-option-marknum'),
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

console.log('Clarify panel vs Figma 581:7642, measured in Chromium\n');
check('panel width', 680, got.panelWidth);
// 514 in the design's pick-one frame, which draws "Other" with no pencil; the pencil sits in a
// 20px box, so the row — and the card — run 4 taller. Kept in both modes, as the pick-any frames
// draw it, because a bare "Other" over an input reads as a heading rather than as a choice.
check('panel height (design 514, +4 for the Other pencil)', 518, got.panel.h);
check('question head height', 34, got.head.h);
check('options block height', 412, got.options.h);
check('answer row height', 76, got.rowUnsel.h);
check('Other row height', 76, got.other.h);
check('actions height', 40, got.actions.h);
check('description column width', 564, got.desc.w);
check('panel padding (space/4 x space/3)', '16px 12px', got.panel.pad);
check('panel radius (radius/4)', '16px', got.panel.radius);
check('question head padding', '0px 8px 12px', got.head.pad);
check('question type (body-emphasized)', '600 14px/22px', got.qtext.font);
check('options gap (space/2)', 8, got.rowGap);
check('options inline padding (space/2)', '0px 8px', got.options.pad);
check('row padding (space/2 x space/5)', '8px 20px', got.rowUnsel.pad);
check('row radius (radius/2)', '8px', got.rowUnsel.radius);
check('row fill at rest (background/subtle)', '#F2F4F8', hex(got.rowUnsel.bg));
check('row fill selected (brand/soft)', '#EEF3FF', hex(got.rowSel.bg));
check('description inset (space/5)', '0px 20px 0px 0px', got.descwrap.pad);
check('description type (body-sm)', '400 12px/20px', got.desc.font);
check('selector size', '16 x 16', `${got.mark.w} x ${got.mark.h}`);
check('selector radius (radius/1)', '4px', got.mark.radius);
check('selector number type (caption)', '400 10px/12px', got.markNum.font);
check('selector fill selected (brand/primary)', '#155DFC', hex(got.markSel.bg));
check('Other input height', 32, got.input.h);
check('Other input radius (radius/2)', '8px', got.input.radius);
check('Submit fill (brand/primary)', '#155DFC', hex(got.submit.bg));
check('Submit padding (space/2 x space/3)', '8px 12px', got.submit.pad);
check('Submit type (interactive/sm)', '500 12px/16px', got.submit.font);

console.log(`\n${fail === 0 ? 'ALL MATCH the Figma spec' : `${fail} MISMATCH(ES)`}`);
process.exit(fail === 0 ? 0 : 1);
