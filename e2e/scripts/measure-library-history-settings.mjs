/**
 * Measure the Library, History and Settings pages against their Figma specs.
 *
 * Source of truth, GLKB-Tokenized:
 *   Library  → 176:8230 (folder rail 176:8306, header 176:8340, toolbar 176:8348, list 176:8363)
 *   History  → 176:11916 (column 176:11992, body 176:12000, row 176:12011)
 *   Settings → 244:5280 (column 244:5023, rows 244:5027 onward)
 *
 * These three pages sit behind auth, so the running app cannot be driven to them without
 * credentials. This renders the real stylesheets over the markup the components emit and
 * checks the numbers the design specifies — the same approach as the other measure-* scripts.
 *
 *   node e2e/scripts/measure-library-history-settings.mjs
 *
 * Exits non-zero on any mismatch. Set CHROME_BIN if Chromium is not where playwright expects it.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const css = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const LIBRARY_CSS = css('src/components/Library/scoped.css');
const HISTORY_CSS = css('src/components/History/scoped.css');
const CARD_CSS = css('src/components/Units/ConversationCard/scoped.css');
const SETTINGS_CSS = css('src/components/AccountPage/scoped.css');

const SHELL = (style, body) => `<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap">
<style>
*{box-sizing:border-box} body{margin:0;font-family:Geist,sans-serif}
.MuiSvgIcon-root{width:1em;height:1em;display:inline-block;fill:currentColor;flex-shrink:0}
.MuiTypography-root{margin:0}
${style}
</style></head><body>${body}</body></html>`;

const hex = (rgb) => {
    const m = String(rgb).match(/\d+/g);
    if (!m) return rgb;
    return `#${m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
};

const browser = await chromium.launch(
    process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {},
);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const PROBE = `(sel) => {
    const round = (n) => Math.round(n * 100) / 100;
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
        w: round(r.width), h: round(r.height), pad: cs.padding, gap: cs.gap,
        radius: cs.borderRadius, bg: cs.backgroundColor, color: cs.color,
        font: cs.fontWeight + ' ' + cs.fontSize + '/' + cs.lineHeight,
        borderBottom: cs.borderBottomWidth + ' ' + cs.borderBottomColor,
        borderRight: cs.borderRightWidth + ' ' + cs.borderRightColor,
    };
}`;

let fail = 0;
const check = (label, want, have) => {
    const ok = String(want) === String(have);
    if (!ok) fail += 1;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(46)} want ${String(want).padStart(16)}  got ${have}`);
};

// ---------------------------------------------------------------- Library
await page.setContent(SHELL(LIBRARY_CSS + CARD_CSS, `
<div class="library-body">
  <div class="library-folder-manager">
    <button class="library-folder-manager-item is-active">
      <span class="library-folder-manager-icon"></span>
      <span class="library-folder-manager-label">All Items</span>
      <span class="library-folder-manager-count">27</span>
    </button>
    <div class="library-folder-manager-section">
      <div class="library-folder-manager-section-header">
        <span class="library-folder-manager-section-title">Folders</span>
      </div>
      <div class="library-folder-manager-list">
        <button class="library-folder-manager-item">
          <span class="library-folder-manager-icon"></span>
          <span class="library-folder-manager-label">Type 1 Diabetes</span>
          <span class="library-folder-manager-count">3</span>
        </button>
        <button class="library-folder-manager-item library-folder-manager-add">
          <span class="library-folder-manager-icon"></span>
          <span class="library-folder-manager-label">Add new folder</span>
        </button>
      </div>
    </div>
  </div>
  <div class="library-content" style="width:960px">
    <div class="library-header">
      <div class="library-title-bar"><p class="library-title MuiTypography-root">Library</p></div>
      <p class="library-subtitle MuiTypography-root">Your personal research workspace.</p>
      <div class="library-tabs-row">
        <p class="library-count MuiTypography-root">All References (13)</p>
        <div class="library-toolbar-actions">
          <div class="library-segmented">
            <button class="library-segmented-option is-active">Reference</button>
            <button class="library-segmented-option">Chat</button>
          </div>
          <div class="library-sort">
            <span class="library-sort-label">Sort:</span>
            <button class="library-sort-pill">Date added</button>
          </div>
        </div>
      </div>
      <div class="library-search"><input class="library-search-input" placeholder="Search All Items..."></div>
    </div>
    <div class="library-scroll"></div>
    <div class="library-chat-list">
      <div class="history-item-row history-item-row-no-checkbox">
        <div class="history-item">
          <span class="history-item-icon"><svg viewBox="0 0 20 20"></svg></span>
          <div class="history-item-content">
            <div class="history-item-title-row"><span class="history-title">Interferons are key cytokines.</span></div>
            <div class="library-card-meta"><span>Just now</span><span class="library-card-meta-sep">&middot;</span><span>5 Messages</span></div>
          </div>
        </div>
      </div>
    </div>
    <div class="library-reference-list">
      <div class="history-item-row history-item-row-no-checkbox">
        <div class="history-item">
          <div class="library-entry-content">
            <span class="library-entry-title">Interferons are key cytokines.</span>
            <span class="library-entry-meta">Coomans de Brach&egrave;ne A et al. &middot; 2024</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`));
await page.waitForTimeout(1200);

console.log('Library vs Figma 176:8230\n');
const lib = {};
for (const [k, sel] of Object.entries({
    rail: '.library-folder-manager',
    railTitle: '.library-folder-manager-section-title',
    railItem: '.library-folder-manager-list .library-folder-manager-item',
    railActive: '.library-folder-manager-item.is-active',
    railCount: '.library-folder-manager-list .library-folder-manager-count',
    railList: '.library-folder-manager-list',
    content: '.library-content',
    title: '.library-title',
    subtitle: '.library-subtitle',
    toolbar: '.library-tabs-row',
    count: '.library-count',
    actions: '.library-toolbar-actions',
    segmented: '.library-segmented',
    sortPill: '.library-sort-pill',
    search: '.library-search-input',
    chatRow: '.library-chat-list .history-item',
    chatIcon: '.library-chat-list .history-item-icon',
    chatTitle: '.library-chat-list .history-title',
    chatMeta: '.library-card-meta',
    refRow: '.library-reference-list .history-item',
    refTitle: '.library-entry-title',
    refMeta: '.library-entry-meta',
})) lib[k] = await page.evaluate(new Function('sel', `return (${PROBE})(sel)`), sel);

check('folder rail width', 240, lib.rail.w);
check('folder rail padding (space/6 x space/4)', '24px 16px', lib.rail.pad);
check('folder rail fill (background/surface)', '#FFFFFF', hex(lib.rail.bg));
check('folder rail border (border/default)', '1px #E5E9F0', `${lib.rail.borderRight.split(' ')[0]} ${hex(lib.rail.borderRight.split(' ').slice(1).join(' '))}`);
check('"Folders" type (interactive/sm)', '500 12px/16px', lib.railTitle.font);
check('"Folders" colour (text/tertiary)', '#5E6E87', hex(lib.railTitle.color));
check('folder row height', 32, lib.railItem.h);
check('folder row padding (space/3)', '0px 12px', lib.railItem.pad);
check('folder row radius (radius/2)', '8px', lib.railItem.radius);
check('folder row type (body)', '400 14px/22px', lib.railItem.font);
check('folder list gap (space/2)', '8px', lib.railList.gap);
check('selected folder fill (brand/soft)', '#EEF3FF', hex(lib.railActive.bg));
check('selected folder colour (brand/primary)', '#155DFC', hex(lib.railActive.color));
check('selected folder type (interactive/default)', '500 14px/18px', lib.railActive.font);
check('folder count type (body)', '400 14px/22px', lib.railCount.font);
check('content gutter (space/24)', '24px 96px', lib.content.pad);
check('page title (h3)', '600 24px/32px', lib.title.font);
check('page subtitle (body)', '400 14px/22px', lib.subtitle.font);
check('toolbar row height', 28, lib.toolbar.h);
check('count label (h4)', '600 20px/28px', lib.count.font);
check('toolbar actions gap (space/4)', '16px', lib.actions.gap);
check('segmented height', 28, lib.segmented.h);
check('segmented radius', '6px', lib.segmented.radius);
check('sort pill height', 28, lib.sortPill.h);
check('sort pill radius (radius/2)', '8px', lib.sortPill.radius);
check('search height', 36, lib.search.h);
check('search radius (radius/2)', '8px', lib.search.radius);
// Vertical rhythm of the content column: header 58, +48 to the toolbar,
// +16 to the search, +16 to the list — Figma 176:8339 / 176:8347 / 176:8363.
const libGaps = await page.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    const round = (n) => Math.round(n * 100) / 100;
    return {
        headerToToolbar: round(r('.library-tabs-row').top - r('.library-subtitle').bottom),
        toolbarToSearch: round(r('.library-search').top - r('.library-tabs-row').bottom),
        searchToList: round(r('.library-scroll').top - r('.library-search').bottom),
        listInset: round(r('.library-scroll').left - r('.library-search').left),
    };
});
check('header block to toolbar (space/12)', 48, libGaps.headerToToolbar);
check('toolbar to search (space/4)', 16, libGaps.toolbarToSearch);
check('search to list (space/4)', 16, libGaps.searchToList);
check('list shares the header column', 0, libGaps.listInset);
// Chat rows follow History's row, not the reference row's fixed 80px box.
check('chat row padding (space/4)', '16px', lib.chatRow.pad);
check('chat row gap (space/4)', '16px', lib.chatRow.gap);
check('chat row height (2 lines + padding)', 72, lib.chatRow.h);
check('chat row glyph size', '20 x 20', `${lib.chatIcon.w} x ${lib.chatIcon.h}`);
check('chat row title (interactive/lg)', '500 16px/20px', lib.chatTitle.font);
check('chat row title colour (text/primary)', '#0C1018', hex(lib.chatTitle.color));
check('chat row meta (body-sm)', '400 12px/20px', lib.chatMeta.font);
check('chat row meta colour (text/tertiary)', '#5E6E87', hex(lib.chatMeta.color));
// Reference rows keep the design's fixed 80px box.
check('reference row height', 80, lib.refRow.h);
check('reference row padding', '0px 16px', lib.refRow.pad);
check('reference title (h5)', '600 16px/20px', lib.refTitle.font);
check('reference meta (body-sm)', '400 12px/20px', lib.refMeta.font);

// ---------------------------------------------------------------- History
await page.setContent(SHELL(HISTORY_CSS + CARD_CSS, `
<div class="history-content" style="width:1200px">
  <div class="history-top">
    <div class="history-header">
      <div class="history-title-row"></div>
      <div class="history-search"><input class="history-search-input" placeholder="Search conversations..."></div>
    </div>
    <div class="history-meta-row">
      <div class="history-select-toolbar history-select-toolbar-empty">
        <div class="history-select-toolbar-content">
          <p class="history-meta-text MuiTypography-root">4 search history records with GLKB</p>
        </div>
      </div>
      <button class="history-select-toggle">Select</button>
    </div>
  </div>
  <div class="history-list">
    <div class="history-item-row history-item-row-no-checkbox">
      <button class="history-item">
        <span class="history-item-icon"><svg viewBox="0 0 20 20"></svg></span>
        <div class="history-item-content">
          <div class="history-item-title-row"><span class="history-title">Interferons are key cytokines.</span></div>
          <div class="history-card-meta"><span>Just now</span><span class="history-card-meta-sep">&middot;</span><span>5 Messages</span></div>
        </div>
      </button>
    </div>
  </div>
</div>`));
await page.waitForTimeout(1200);

console.log('\nHistory vs Figma 176:11916\n');
const his = {};
for (const [k, sel] of Object.entries({
    content: '.history-content',
    search: '.history-search-input',
    metaRow: '.history-meta-row',
    metaText: '.history-meta-text',
    select: '.history-select-toggle',
    row: '.history-item',
    rowRule: '.history-item-row',
    title: '.history-title',
    meta: '.history-card-meta',
    content2: '.history-item-content',
})) his[k] = await page.evaluate(new Function('sel', `return (${PROBE})(sel)`), sel);

const gaps = await page.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    const round = (n) => Math.round(n * 100) / 100;
    const row = r('.history-meta-row');
    return {
        headerToSearch: round(r('.history-search').top - r('.history-title-row').bottom),
        searchToMeta: round(r('.history-meta-row').top - r('.history-search').bottom),
        metaToList: round(r('.history-list').top - r('.history-meta-row').bottom),
        // Figma 176:12005 is justify-between inside a 4px inset: the count is
        // flush left, Select is flush right.
        countInset: round(r('.history-meta-text').left - row.left),
        selectInset: round(row.right - r('.history-select-toggle').right),
        rowIcon: round(r('.history-item-icon').left - r('.history-item').left),
    };
});

// the row rule lives on ::before, so it has to be read separately
const ruleColour = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.history-item-row'), '::before');
    return `${cs.borderBottomWidth} ${cs.borderBottomColor}`;
});

check('content gutter (space/24 x space/6)', '24px 96px', his.content.pad);
check('search height', 36, his.search.h);
check('meta row inset (space/1)', '0px 4px', his.metaRow.pad);
check('meta text (body-sm on secondary)', '400 12px/20px', his.metaText.font);
check('meta text colour', '#222A38', hex(his.metaText.color));
check('Select control (interactive/sm)', '500 12px/16px', his.select.font);
check('Select control height', 24, his.select.h);
check('Select control inset (space/2)', '0px 8px', his.select.pad);
check('count sits flush left in the 4px inset', 4, gaps.countInset);
check('Select sits flush right in the 4px inset', 4, gaps.selectInset);
check('row glyph starts after the 16px padding', 16, gaps.rowIcon);
check('header block to search (space/12)', 48, gaps.headerToSearch);
check('search to meta row (space/4)', 16, gaps.searchToMeta);
check('meta row to list (space/2)', 8, gaps.metaToList);
check('row padding (space/4)', '16px', his.row.pad);
check('row rule (border/default)', '1px #E5E9F0', `${ruleColour.split(' ')[0]} ${hex(ruleColour.split(' ').slice(1).join(' '))}`);
check('row title (interactive/lg)', '500 16px/20px', his.title.font);
check('row title colour (text/primary)', '#0C1018', hex(his.title.color));
check('row meta (body-sm on tertiary)', '400 12px/20px', his.meta.font);
check('row meta colour', '#5E6E87', hex(his.meta.color));
check('title/meta gap', '0px', his.content2.gap === 'normal' ? '0px' : his.content2.gap);


// ---------------------------------------------------------------- Settings
await page.setContent(SHELL(SETTINGS_CSS, `
<div class="settings-content">
  <div class="settings-inner">
    <h2 class="settings-title settings-title-first">Account</h2>
    <div class="settings-row">
      <span class="settings-row-label">Email</span>
      <span class="settings-row-value">sofia@gmail.com</span>
    </div>
    <div class="settings-row settings-row-last">
      <span class="settings-row-labels">
        <span class="settings-row-label">Display Name</span>
        <span class="settings-row-sub">Sofia3783</span>
      </span>
      <button class="settings-row-action">Edit</button>
    </div>
    <h2 class="settings-title">Usage &amp; Balance</h2>
    <div class="settings-row settings-row-stacked">
      <div class="settings-row-head">
        <span class="settings-row-label">Monthly Queries</span>
        <span class="settings-row-chip">Next reset in 10 days</span>
      </div>
      <div class="subscription-progress"><div class="subscription-progress-fill" style="width:20%"></div></div>
      <div class="subscription-progress-footer">
        <span class="subscription-progress-used">4 used</span><span>496 remaining</span>
      </div>
    </div>
  </div>
</div>`));
await page.waitForTimeout(1200);

console.log('\nSettings vs Figma 244:5280\n');
const set = {};
for (const [k, sel] of Object.entries({
    inner: '.settings-inner',
    content: '.settings-content',
    titleFirst: '.settings-title-first',
    title: '.settings-title:not(.settings-title-first)',
    row: '.settings-row',
    rowLast: '.settings-row-last',
    label: '.settings-row-label',
    sub: '.settings-row-sub',
    value: '.settings-row-value',
    action: '.settings-row-action',
    chip: '.settings-row-chip',
    bar: '.subscription-progress',
    fill: '.subscription-progress-fill',
    footer: '.subscription-progress-footer',
    used: '.subscription-progress-used',
})) set[k] = await page.evaluate(new Function('sel', `return (${PROBE})(sel)`), sel);

const settingsGap = await page.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    const title = [...document.querySelectorAll('.settings-title')][1];
    return Math.round((title.getBoundingClientRect().top - r('.settings-row-last').bottom) * 100) / 100;
});

check('column width', 680, set.inner.w);
check('column top padding (space/12)', '48px 48px 0px', set.content.pad);
check('page fill (background/page)', '#FDFEFF', hex(set.content.bg));
check('section title (h4)', '600 20px/28px', set.title.font);
check('section title block padding (space/2)', '8px 0px', set.title.pad);
check('section gap (space/12)', 48, settingsGap);
check('row padding (space/5)', '20px 0px', set.row.pad);
check('row rule (border/default)', '1px #E5E9F0', `${set.row.borderBottom.split(' ')[0]} ${hex(set.row.borderBottom.split(' ').slice(1).join(' '))}`);
check('last row in section drops the rule', '0px', set.rowLast.borderBottom.split(' ')[0]);
check('row label (interactive/lg)', '500 16px/20px', set.label.font);
check('row label colour (text/secondary)', '#222A38', hex(set.label.color));
check('row sub value (body)', '400 14px/22px', set.sub.font);
check('row plain value (interactive/default)', '500 14px/18px', set.value.font);
check('row value colour (text/secondary)', '#222A38', hex(set.value.color));
check('action chip height', 28, set.action.h);
check('action chip fill (background/muted)', '#E5E9F0', hex(set.action.bg));
check('action chip radius (radius/2)', '8px', set.action.radius);
check('action chip type (interactive/sm)', '500 12px/16px', set.action.font);
check('inline chip padding', '4px 8px', set.chip.pad);
check('inline chip type (interactive/default)', '500 14px/18px', set.chip.font);
check('progress track height', 8, set.bar.h);
check('progress track fill (brand/muted)', '#D9E6FE', hex(set.bar.bg));
check('progress bar fill (brand/primary)', '#155DFC', hex(set.fill.bg));
check('progress footer type (interactive/default)', '500 14px/18px', set.footer.font);
check('"used" colour (brand/primary)', '#155DFC', hex(set.used.color));

await browser.close();
console.log(`\n${fail === 0 ? 'ALL MATCH the Figma specs' : `${fail} MISMATCH(ES)`}`);
process.exit(fail === 0 ? 0 : 1);
