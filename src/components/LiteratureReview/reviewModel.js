/**
 * What the Literature Review pages read out of a review and its progress.
 *
 * A finished review has a narrow shape (see utils/reviewToLatex.js): `# title`, `## section`
 * blocks of prose with `[3]` / `[3, 7]` citations, a `## References` list of
 * `3. Title. (2024). PMID 37875462.`, and a closing comment the pipeline writes itself:
 *   <!-- words 4818 / target 6000; cited papers 106; fabricated citations 1 -->
 * That comment is the review's own audit (glkb-agent literature_review: report_artifact's
 * terminal_audit), so the page's numbers are the pipeline's, not re-counted guesses.
 */

/** The four stages of a run, as the review service reports them, with the share of the bar
 *  each owns (glkb-agent literature_review/worker.py STAGE_SPAN). */
// `doing` is the stage as the phone design's list words it ("Searching literature").
export const STAGES = [
    { id: 'acquisition', span: [2, 45], label: 'Search & select', doing: 'Searching the literature',
      detail: 'PubMed, the GLKB knowledge graph, citation chaining' },
    { id: 'synthesis', span: [45, 70], label: 'Synthesize', doing: 'Synthesizing the evidence',
      detail: 'Claims extracted from the papers and related to each other' },
    { id: 'planning', span: [70, 80], label: 'Outline', doing: 'Outlining sections',
      detail: 'Sections, their order and how long each should be' },
    { id: 'writing', span: [80, 99], label: 'Write', doing: 'Writing sections',
      detail: 'Every sentence written from its cited evidence' },
];

export const stageIndex = (phase) => Math.max(0, STAGES.findIndex((s) => s.id === phase));

/** How full each stage's segment of the bar is, 0..1. */
export const stageFill = (percent, phase) => {
    const at = stageIndex(phase);
    return STAGES.map((stage, i) => {
        if (i < at) return 1;
        if (i > at) return 0;
        const [lo, hi] = stage.span;
        return Math.max(0.04, Math.min(1, ((Number(percent) || 0) - lo) / (hi - lo)));
    });
};

/** Minutes left, from how far the bar has come in the time taken. Nothing until the estimate
 *  means something (the first stage's searches set the pace). */
export const minutesLeft = (percent, elapsedSeconds) => {
    const p = Number(percent) || 0;
    if (p < 8 || p >= 99 || !(elapsedSeconds > 30)) return null;
    return Math.max(1, Math.round(((elapsedSeconds * (100 - p)) / p) / 60));
};

const AUDIT_RE = /<!--\s*words\s+(\d+)\s*\/\s*target\s+(\d+);\s*cited papers\s+(\d+);\s*fabricated citations\s+(\d+)\s*-->/i;

export const reviewAudit = (markdown) => {
    const m = AUDIT_RE.exec(String(markdown || ''));
    if (!m) return null;
    const [words, target, cited, fabricated] = m.slice(1).map(Number);
    return { words, target, cited, fabricated, verified: Math.max(0, cited - fabricated) };
};

const REFERENCE_RE = /^(\d+)\.\s+(.*?)(?:\s+\((\d{4})\))?\.?\s*(?:PMID\s+(\d+)\.?)?\s*$/;

/** `## References` lines -> [{number, title, year, pmid, url}]. */
export const parseReferenceList = (lines) => lines
    .map((line) => REFERENCE_RE.exec(line.trim()))
    .filter(Boolean)
    .map(([, n, title, year, pmid]) => ({
        number: Number(n),
        title: title.replace(/\.$/, ''),
        year: year ? Number(year) : null,
        pmid: pmid || null,
        url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : null,
    }));

/**
 * markdown -> { title, intro, sections: [{id, number, title, body}], references, audit }.
 * `references` prefers the structured list the service returned (`given`) over the parsed one.
 */
export const parseReview = (markdown, given = []) => {
    const text = String(markdown || '').replace(/<!--[\s\S]*?-->/g, '');
    const lines = text.split('\n');
    let title = '';
    const intro = [];
    const sections = [];
    const refLines = [];
    let current = null;
    let inRefs = false;
    for (const line of lines) {
        const h1 = /^#\s+(.*)$/.exec(line);
        const h2 = /^##\s+(.*)$/.exec(line);
        if (h1 && !title && !current) { title = h1[1].trim(); continue; }
        if (h2) {
            inRefs = /^references$/i.test(h2[1].trim());
            if (inRefs) { current = null; continue; }
            current = { id: `section-${sections.length + 1}`, number: sections.length + 1, title: h2[1].trim(), body: [] };
            sections.push(current);
            continue;
        }
        if (inRefs) refLines.push(line);
        else if (current) current.body.push(line);
        else intro.push(line);
    }
    const parsedRefs = parseReferenceList(refLines);
    const references = (Array.isArray(given) && given.length ? given : parsedRefs).map((ref, i) => ({
        ...ref,
        number: Number(ref.number) || i + 1,
        pmid: ref.pmid ? String(ref.pmid) : null,
        year: ref.year || ref.date || null,
    }));
    return {
        title,
        intro: intro.join('\n').trim(),
        sections: sections.map((s) => ({ ...s, body: s.body.join('\n').trim() })),
        references,
        audit: reviewAudit(markdown),
    };
};

/** Words in the review's prose (title, headings and the reference list left out). */
export const countWords = (review) => [review.intro, ...review.sections.map((s) => s.body)]
    .join(' ')
    .replace(/\[(\d+(?:\s*[,–-]\s*\d+)*)\]/g, ' ')
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w)).length;

/**
 * Citation markers -> markdown links the page renders as pills: `[3, 7]` becomes
 * `[3, 7](#cite=3,7)`. A real link (`[text](url)`) is left alone.
 */
export const linkCitations = (markdown) => String(markdown || '').replace(
    /\[(\d+(?:\s*[,–-]\s*\d+)*)\](?!\()/g,
    (whole, inner) => `[${inner}](#cite=${expandCitation(inner).join(',')})`,
);

/** "3, 5–7" -> [3, 5, 6, 7]. */
export const expandCitation = (inner) => String(inner).split(/\s*,\s*/).flatMap((part) => {
    const range = /^(\d+)\s*[–-]\s*(\d+)$/.exec(part);
    if (!range) return [Number(part)].filter(Number.isFinite);
    const [a, b] = [Number(range[1]), Number(range[2])];
    return b >= a && b - a < 50 ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a, b];
});

// ── Editing a saved review: the paragraph actions (Ask, Rewrite, Shorten, Add evidence) ──────

const CITE_RE = /\[(\d+(?:\s*[,–-]\s*\d+)*)\](?!\()/g;

/**
 * The top-level blocks of a markdown string (separated by blank lines): each one's own text, and
 * where it lies once `linkCitations` has rewritten the string — the string ReactMarkdown parses, so
 * a rendered paragraph's `node.position` finds the block it came from, citations as stored.
 */
export const markdownBlocks = (markdown) => {
    const text = String(markdown || '');
    const blocks = [];
    const separator = /\n[ \t]*\n/g;
    let start = 0;
    let at = 0;
    let match;
    const push = (end, sepLength) => {
        const block = text.slice(start, end);
        const linked = linkCitations(block).length;
        blocks.push({ text: block, tStart: at, tEnd: at + linked });
        at += linked + sepLength;
    };
    while ((match = separator.exec(text))) {
        push(match.index, match[0].length);
        start = match.index + match[0].length;
    }
    push(text.length, 0);
    return blocks;
};

/** Whether a block is a paragraph of prose (not a heading, list, quote, table or code). */
export const isProseBlock = (block) => {
    const t = String(block || '').trimStart();
    return t.length > 0 && !/^(#|[-*+]\s|\d+[.)]\s|>|\||```|<)/.test(t) && /[A-Za-z]/.test(t);
};

/** The review with one paragraph replaced, or null when that paragraph is no longer in it. */
export const replaceParagraph = (markdown, oldText, newText) => {
    const md = String(markdown || '');
    const at = oldText ? md.indexOf(oldText) : -1;
    if (at < 0) return null;
    return md.slice(0, at) + newText + md.slice(at + oldText.length);
};

/**
 * The review numbered again by first appearance (Vancouver: [1] is the first paper the text cites),
 * after an edit added or dropped citations: every `[n]` rewritten, the references renumbered and
 * those no longer cited dropped, the `## References` list and the audit comment's counts rebuilt.
 * `references` may hold new papers numbered past the old list (Add evidence).
 */
export const renumberReview = (markdown, references) => {
    const md = String(markdown || '');
    const audit = reviewAudit(md);
    const cut = md.search(/^##\s+References\s*$/im);
    const body = (cut >= 0 ? md.slice(0, cut) : md.replace(/<!--[\s\S]*?-->/g, '')).trimEnd();
    const byOld = new Map((references || []).map((r) => [Number(r.number), r]));
    const renumber = new Map();
    for (const m of body.matchAll(CITE_RE)) {
        for (const n of expandCitation(m[1])) {
            if (byOld.has(n) && !renumber.has(n)) renumber.set(n, renumber.size + 1);
        }
    }
    const newBody = body.replace(CITE_RE, (whole, inner) => {
        const nums = [...new Set(expandCitation(inner).map((n) => renumber.get(n)).filter(Boolean))]
            .sort((a, b) => a - b);
        return nums.length ? `[${nums.join(', ')}]` : '';
    });
    const refs = [...renumber.entries()].map(([old, number]) => ({ ...byOld.get(old), number }));
    const lines = refs.map((r) => `${r.number}. ${r.title || 'Untitled'}${r.year ? ` (${r.year})` : ''}.`
        + (r.pmid && r.source !== 'upload' ? ` PMID ${r.pmid}.` : ''));
    let out = `${newBody}\n\n## References\n\n${lines.join('\n')}\n`;
    if (audit) {
        const words = countWords(parseReview(out, refs));
        out += `\n<!-- words ${words} / target ${audit.target}; cited papers ${refs.length}; `
            + `fabricated citations ${audit.fabricated} -->\n`;
    }
    return { markdown: out, references: refs };
};

// ── Selecting text in a paragraph: where the reader's selection lies in the paragraph's markdown ──

/* What a rendered paragraph shows and its markdown does not, or the other way round: the citations
   (pills, or author–year phrases), and markdown's own marks. Neither is compared: a character is
   compared only when it is neither whitespace nor one of these marks. */
const SKIPPED = /[\s*_`\\]/;

/** The comparable characters of `text`, and (with `from`) where each one is in the original. */
const keyOf = (text, from = null) => {
    let key = '';
    const at = [];
    for (let i = 0; i < text.length; i += 1) {
        if (!SKIPPED.test(text[i])) {
            key += text[i];
            if (from) at.push(from[i]);
        }
    }
    return { key, at };
};

const TRAILING_CITE_RE = /^[ \t]*\[(\d+(?:\s*[,–-]\s*\d+)*)\](?!\()/;
const WORD_CHAR = /[\p{L}\p{N}]/u;

/**
 * The part of a paragraph's markdown (`source`, citations as `[n]`) that the reader selected, from
 * the text the page showed: `before` — the paragraph's text before the selection — and `inside` —
 * the selected text — both without the citations' own text (the caller leaves the citation
 * elements out). Returns `{ text, start, whole }`: the exact substring of `source`, its offset, and
 * whether it is the whole paragraph; or null when the selection cannot be found in it.
 *
 * The span is widened to whole words, and over a citation right after it: a citation belongs to
 * the clause it ends, so a rewritten clause keeps (or drops) its own.
 */
export const locateSelection = (source, before, inside) => {
    const src = String(source || '');
    // The source without its citations, each kept character pointing back to where it was.
    const plainIdx = [];
    let plain = '';
    let last = 0;
    for (const m of src.matchAll(CITE_RE)) {
        for (let i = last; i < m.index; i += 1) { plain += src[i]; plainIdx.push(i); }
        last = m.index + m[0].length;
    }
    for (let i = last; i < src.length; i += 1) { plain += src[i]; plainIdx.push(i); }
    const { key: sKey, at: sAt } = keyOf(plain, plainIdx);
    const want = keyOf(String(inside || '')).key;
    if (!want || !sKey) return null;
    let from = keyOf(String(before || '')).key.length;
    if (sKey.slice(from, from + want.length) !== want) {
        // The page and the markdown disagree before the selection (a link, an escape): look for it.
        from = sKey.indexOf(want);
        if (from < 0) return null;
    }
    let start = sAt[from];
    let end = sAt[from + want.length - 1] + 1;
    while (start > 0 && WORD_CHAR.test(src[start - 1]) && WORD_CHAR.test(src[start])) start -= 1;
    while (end < src.length && WORD_CHAR.test(src[end]) && WORD_CHAR.test(src[end - 1])) end += 1;
    // Markdown marks around the span go with it, so emphasis is not cut in half.
    while (start > 0 && /[*_`]/.test(src[start - 1])) start -= 1;
    while (end < src.length && /[*_`]/.test(src[end])) end += 1;
    const cite = TRAILING_CITE_RE.exec(src.slice(end));
    if (cite) end += cite[0].length;
    const text = src.slice(start, end);
    const trimmedStart = start + (text.length - text.trimStart().length);
    const trimmed = text.trim();
    if (!trimmed) return null;
    // All of it, but for the closing full stop (or a quote mark), is the whole paragraph.
    const rest = (src.slice(0, start) + src.slice(end)).replace(/[\s.!?;:,)"'”’]/g, '');
    return { text: trimmed, start: trimmedStart, whole: rest === '' };
};

/** Words of prose, citations left out (the paragraph actions' "N fewer words"). */
export const proseWords = (text) => String(text || '').replace(CITE_RE, ' ')
    .split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
