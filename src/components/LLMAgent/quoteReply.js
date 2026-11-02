/**
 * Reply to a passage of an answer: select text in an assistant answer, press Reply, and the next
 * question carries that passage as a quote.
 *
 * The quote travels as Markdown inside the question itself — `> ` on every line, a blank line,
 * then what the reader typed — so both pipelines read it with no new request field, the history
 * keeps it with the question, and the question's bubble (which renders Markdown) draws it as a
 * blockquote.
 *
 * The selection rules mirror the Literature Review's selection toolbar (ReviewDocument.jsx): a
 * selection counts only when it lies inside ONE answer's body; one that strays into another
 * message, a question, or the page around them shows nothing.
 */

/** The longest quote a question carries; longer selections are cut, with an ellipsis. */
export const QUOTE_MAX_CHARS = 1500;

/** How much of the quote the composer's chip shows. The whole quote is still sent. */
export const QUOTE_PREVIEW_CHARS = 160;

/** The body of an assistant answer — where a selection may start a reply. */
const ANSWER_BODY = '.message-card[data-message-role="assistant"] .markdown-body';

/* What a quote leaves out: the inline citation numbers (they mean nothing outside their answer),
   the in-text knowledge graph's controls and drawing, and any button. */
const SKIPPED = '.inline-citation-number, button, svg, canvas, script, style, [class^="ag-"], [class*=" ag-"]';
const BLOCKS = new Set([
    'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'TR', 'TABLE', 'UL', 'OL',
    'DIV', 'SECTION', 'FIGURE', 'FIGCAPTION', 'DL', 'DT', 'DD',
]);

/** A selection's text, tidied: one space between words, at most one blank line, trimmed, capped. */
export const clipQuote = (text) => {
    const clean = String(text ?? '')
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t ]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (clean.length <= QUOTE_MAX_CHARS) return clean;
    return `${clean.slice(0, QUOTE_MAX_CHARS - 1).trimEnd()}…`;
};

/**
 * The question as sent: the quote as a Markdown blockquote ("> " on each line, a bare ">" on a
 * blank one so the quote stays one block), a blank line, then the question. No quote, no change.
 */
export const withQuote = (question, quote) => {
    const clipped = clipQuote(quote);
    if (!clipped) return question;
    const block = clipped
        .split('\n')
        .map((line) => (line.trim() ? `> ${line}` : '>'))
        .join('\n');
    return `${block}\n\n${question}`;
};

/** The quote on one line, cut for the composer's chip. */
export const quotePreview = (quote, max = QUOTE_PREVIEW_CHARS) => {
    const line = String(quote ?? '').replace(/\s+/g, ' ').trim();
    return line.length <= max ? line : `${line.slice(0, max - 1).trimEnd()}…`;
};

const elementOf = (node) => (node?.nodeType === 1 ? node : node?.parentElement) || null;

/** The assistant answer body a DOM node is in, or null. */
export const answerBodyOf = (node) => elementOf(node)?.closest?.(ANSWER_BODY) || null;

const textOf = (node) => {
    if (node.nodeType === 3) return node.nodeValue || '';
    if (node.nodeType !== 1 && node.nodeType !== 11) return '';
    if (node.nodeType === 1) {
        if (node.matches(SKIPPED)) return '';
        if (node.tagName === 'BR') return '\n';
    }
    let out = Array.from(node.childNodes).map(textOf).join('');
    if (node.nodeType === 1) {
        if (node.tagName === 'TD' || node.tagName === 'TH') out += ' ';
        else if (BLOCKS.has(node.tagName)) out += '\n';
    }
    return out;
};

/**
 * A range's text the way a reader sees it: a line per paragraph, list item and table row, and
 * without the citation numbers — whose removal can leave an empty "()" or "[ , ]" behind, which
 * goes too.
 */
export const rangeText = (range) => {
    if (!range || typeof range.cloneContents !== 'function') return '';
    return textOf(range.cloneContents())
        .replace(/[ \t]*[([][\s,;]*[)\]]/g, '')
        .replace(/[ \t]+([.,;:])(?=\s|$)/g, '$1');
};

const compact = (text) => String(text ?? '').replace(/\s+/g, '');

/**
 * The reader's selection, when it is a passage of ONE assistant answer inside `container`:
 * `{ text, range }`, or null.
 *
 * An end may stray just past the answer with nothing selected out there — a triple-click ends
 * its range at the start of whatever follows the paragraph — so the range is clamped to the
 * answer, and accepted only if that loses no text.
 */
export const readAnswerSelection = (container, selection = window.getSelection?.()) => {
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    const body = answerBodyOf(range.startContainer) || answerBodyOf(range.endContainer);
    if (!body || (container && !container.contains(body))) return null;
    const inside = range.cloneRange();
    if (!body.contains(range.startContainer)) inside.setStart(body, 0);
    if (!body.contains(range.endContainer)) inside.setEnd(body, body.childNodes.length);
    if (compact(range.toString()) !== compact(inside.toString())) return null;
    const text = clipQuote(rangeText(inside));
    if (!text) return null;
    return { text, range: inside };
};

/**
 * Where the Reply button goes: centred over the selection, or under it near the top of the
 * window and on a touch screen, whose own copy menu sits above a selection. Clamped to the
 * window. Same placement as the Literature Review's toolbar.
 */
const BUTTON_HALF_WIDTH = 48;
export const replyButtonAt = (range, below = false) => {
    const rect = typeof range?.getBoundingClientRect === 'function'
        ? range.getBoundingClientRect()
        : elementOf(range?.endContainer)?.getBoundingClientRect?.();
    if (!rect) return { top: 0, left: 0 };
    const under = below || rect.top < 120;
    const width = window.innerWidth || 1024;
    const centre = rect.left + rect.width / 2;
    const left = Math.min(Math.max(centre, BUTTON_HALF_WIDTH + 8), Math.max(BUTTON_HALF_WIDTH + 8, width - BUTTON_HALF_WIDTH - 8));
    return { top: under ? rect.bottom + 8 : rect.top - 42, left };
};
