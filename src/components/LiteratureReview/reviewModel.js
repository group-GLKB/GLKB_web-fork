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
export const STAGES = [
    { id: 'acquisition', span: [2, 45], label: 'Search & select',
      detail: 'PubMed, the GLKB knowledge graph, citation chaining' },
    { id: 'synthesis', span: [45, 70], label: 'Synthesize',
      detail: 'Claims extracted from the papers and related to each other' },
    { id: 'planning', span: [70, 80], label: 'Outline',
      detail: 'Sections, their order and how long each should be' },
    { id: 'writing', span: [80, 99], label: 'Write',
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
