/**
 * "Show in answer" under an answer-graph edge: find the edge's sentence in the RENDERED answer,
 * scroll it into view and mark it for a moment.
 *
 * The agent's `sentence` is a sentence of the answer's markdown, so it carries what the page does
 * not show as text — citation markers ("[12345678]", "[[c3]]"), link syntax, emphasis — while the
 * page shows citations as numbered chips. Both sides are therefore reduced to their letters and
 * digits, with the citation chips left out of the page's side, and matched on that. Nothing in
 * the answer's DOM is changed: the mark is the CSS Custom Highlight API where the browser has it
 * (as the Literature Review document does), else a class on the sentence's block for a moment.
 */

/* Citation markers and link syntax, as the agent writes them into an answer. */
const CITATION_PATTERNS = [
    /\[\[\s*c\d+(?:\s*,\s*c\d+)*\s*\]\]/gi, // [[c1, c2]]
    /\[(?:\s*(?:PMID:?\s*)?\d{4,9}\s*[,;]?)+\]\([^)]*\)/gi, // [12345678](https://pubmed…)
    /\[(?:\s*(?:PMID:?\s*)?\d{1,9}\s*[,;]?)+\]/gi, // [12345678], [1, 2], [PMID: 1]
    /\(\s*PMID:?\s*\d+(?:\s*[,;]\s*(?:PMID:?\s*)?\d+)*\s*\)/gi, // (PMID: 12345678)
];

/** The letters and digits a reader sees of a sentence, lower-cased. */
export const sentenceKey = (sentence) => {
    let value = String(sentence || '');
    CITATION_PATTERNS.forEach((re) => { value = value.replace(re, ' '); });
    value = value.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1'); // other links: their words
    return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
};

/* What of the page is not the answer's prose: citation chips, the graph card itself, the
   reference hover card. */
const SKIP = '.inline-citation-number, a[href*="pubmed.ncbi.nlm.nih.gov"], figure, .ag-card, [role="dialog"]';

const isWordChar = (ch) => /[\p{L}\p{N}]/u.test(ch);

/**
 * The answer's text as `sentenceKey` reduces it, with where each kept character came from:
 * `{ key, at: [{ node, offset }] }`.
 */
export const pageKey = (root) => {
    const at = [];
    let key = '';
    if (!root) return { key, at };
    const doc = root.ownerDocument || document;
    const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */, {
        acceptNode: (node) => (node.parentElement?.closest(SKIP) ? 2 /* REJECT */ : 1 /* ACCEPT */),
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const value = node.nodeValue || '';
        for (let i = 0; i < value.length; i += 1) {
            const lower = value[i].toLowerCase();
            for (let j = 0; j < lower.length; j += 1) {
                if (!isWordChar(lower[j])) continue;
                key += lower[j];
                at.push({ node, offset: i });
            }
        }
    }
    return { key, at };
};

/**
 * Where `sentence` is in `root`, as a DOM Range, or null. The whole sentence first; a sentence
 * the page words slightly differently is found by its opening (60 characters) instead.
 */
export const findSentenceRange = (root, sentence) => {
    const wanted = sentenceKey(sentence);
    if (wanted.length < 8 || !root) return null;
    const { key, at } = pageKey(root);
    let start = key.indexOf(wanted);
    let length = wanted.length;
    if (start < 0 && wanted.length > 60) {
        start = key.indexOf(wanted.slice(0, 60));
        length = 60;
    }
    if (start < 0) return null;
    const first = at[start];
    const last = at[start + length - 1];
    const doc = root.ownerDocument || document;
    const range = doc.createRange();
    range.setStart(first.node, first.offset);
    range.setEnd(last.node, Math.min(last.offset + 1, (last.node.nodeValue || '').length));
    return range;
};

const HIGHLIGHT = 'ag-sentence';
const FLASH_CLASS = 'ag-sentence-flash';
const HOLD_MS = 4000;
// The mark on screen, if any: taken down before the next one goes up, or when its time is up.
let current = null;
const takeDown = () => {
    if (!current) return;
    clearTimeout(current.timer);
    current.cleanup();
    current = null;
};

/** The nearest ancestor that scrolls (the conversation's message list), or null. */
const scrollParent = (el) => {
    const win = el?.ownerDocument?.defaultView || window;
    for (let node = el?.parentElement; node; node = node.parentElement) {
        const { overflowY } = win.getComputedStyle(node);
        if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
    }
    return null;
};

/* Scrolls the message list only — never `scrollIntoView`, which moves every scrollable
   ancestor, the page included (see the chat's own scrolling, LLMAgent/index.jsx). */
const bringIntoView = (el, rect) => {
    const container = scrollParent(el);
    if (container) {
        const box = container.getBoundingClientRect();
        const top = container.scrollTop + (rect.top - box.top) - container.clientHeight / 3;
        if (typeof container.scrollTo === 'function') {
            container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        } else {
            container.scrollTop = Math.max(0, top);
        }
        return;
    }
    el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
};

/**
 * Scroll to and mark `sentence` within `root` (the answer's `.markdown-body`). Returns whether it
 * was found.
 */
export const showSentence = (root, sentence) => {
    const range = findSentenceRange(root, sentence);
    if (!range) return false;
    const block = range.startContainer.parentElement?.closest('p, li, td, th, blockquote, h1, h2, h3, h4, h5, h6')
        || range.startContainer.parentElement;
    const rect = typeof range.getBoundingClientRect === 'function'
        ? range.getBoundingClientRect()
        : block?.getBoundingClientRect?.();
    bringIntoView(block, rect || { top: 0 });
    takeDown();
    const win = root.ownerDocument?.defaultView || window;
    let marked = false;
    try {
        if (win.CSS?.highlights && typeof win.Highlight === 'function') {
            win.CSS.highlights.set(HIGHLIGHT, new win.Highlight(range));
            marked = true;
        }
    } catch (error) { /* falls through to the block's flash */ }
    const flashed = !marked && block ? block : null;
    const hadClass = flashed ? flashed.hasAttribute('class') : false;
    if (flashed) flashed.classList.add(FLASH_CLASS);
    const cleanup = () => {
        try { win.CSS?.highlights?.delete(HIGHLIGHT); } catch (error) { /* nothing was marked */ }
        if (!flashed) return;
        flashed.classList.remove(FLASH_CLASS);
        // Left as it was found: a block drawn without a class gets none back.
        if (!hadClass && !flashed.classList.length) flashed.removeAttribute('class');
    };
    current = { cleanup, timer: setTimeout(takeDown, HOLD_MS) };
    return true;
};
