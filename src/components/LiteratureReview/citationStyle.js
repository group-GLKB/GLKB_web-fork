/**
 * A review's citation style: how its references are listed and how the text cites them.
 *
 * The pipeline writes every review the same way — `[3]` / `[3, 7]` in the text and a numbered
 * `## References` list of titles — so a style is applied here, on display and on export, never
 * asked of the pipeline. Switching it on a finished review is instant and costs nothing.
 *
 * The bibliographic data is NCBI's CSL-JSON record for each PMID (service/Citation.js, the same
 * records the "Cite this paper" dialog uses), formatted by the dialog's own formatters
 * (Units/CiteDialog/format.js). A reference whose record cannot be had is formatted from what
 * the review itself carries (title, year, DOI, PMID) rather than dropped.
 *
 *   numeric styles      the text keeps its numbers; the list is in citation order
 *   author-date styles  `[3, 7]` becomes "(Lee et al., 2021; Park & Kim, 2019)"; the list is
 *                       alphabetical, and one first author's two papers of a year become 2021a, 2021b
 */
import { formatCitation, normalizeCsl } from '../Units/CiteDialog/format';
import { expandCitation } from './reviewModel';

export const REVIEW_STYLES = [
    { id: 'vancouver', label: 'Vancouver', format: 'Vancouver', authorDate: false },
    { id: 'ama', label: 'AMA', format: 'AMA', authorDate: false },
    { id: 'nature', label: 'Nature', format: 'Nature', authorDate: false },
    { id: 'apa', label: 'APA 7', format: 'APA', authorDate: true },
    { id: 'harvard', label: 'Harvard', format: 'Harvard', authorDate: true },
];
export const DEFAULT_STYLE = 'vancouver';

export const styleById = (id) => REVIEW_STYLES.find((s) => s.id === id) || REVIEW_STYLES[0];

const STYLE_KEY = 'glkb-review-style';
export const getStylePref = () => {
    try {
        const stored = localStorage.getItem(STYLE_KEY);
        return REVIEW_STYLES.some((s) => s.id === stored) ? stored : DEFAULT_STYLE;
    } catch {
        return DEFAULT_STYLE;
    }
};
export const setStylePref = (id) => {
    try { localStorage.setItem(STYLE_KEY, id); } catch { /* private mode: kept for this page */ }
};

const CITATION_RE = /\[(\d+(?:\s*[,–-]\s*\d+)*)\](?!\()/g;

/** The CSL record for a reference: NCBI's when we have it, else one built from the review's own fields. */
export const cslFor = (reference, records = {}) => {
    const record = reference?.pmid ? records[String(reference.pmid)] : null;
    if (record) return record;
    const year = String(reference?.year || reference?.date || '').match(/\b\d{4}\b/)?.[0];
    const item = { type: 'article-journal', title: reference?.title || '', author: [], partial: true };
    if (year) item.issued = { 'date-parts': [[Number(year)]] };
    if (reference?.journal) item['container-title'] = reference.journal;
    if (reference?.doi) item.DOI = reference.doi;
    if (reference?.pmid) item.PMID = String(reference.pmid);
    return item;
};

const shortTitle = (title) => {
    const words = String(title || 'Untitled').split(/\s+/).filter(Boolean);
    return `“${words.slice(0, 4).join(' ')}${words.length > 4 ? '…' : ''}”`;
};

/** The author part of an author-date citation: APA "A & B" / "A et al."; Harvard "A, B and C" / "A et al.". */
const authorPart = (r, styleId) => {
    const names = r.authors.map((a) => a.family || a.literal).filter(Boolean);
    if (!names.length) return shortTitle(r.title);
    if (styleId === 'apa') {
        if (names.length === 1) return names[0];
        if (names.length === 2) return `${names[0]} & ${names[1]}`;
        return `${names[0]} et al.`;
    }
    if (names.length <= 3) {
        return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    }
    return `${names[0]} et al.`;
};

/**
 * Everything a style needs, computed once per (references, records, style):
 *   entries   [{number, text, label, sortKey}] in the style's list order
 *   byNumber  Map number -> entry
 *   cite(nums) the in-text citation for those reference numbers
 */
export const buildStyle = (references, records, styleId) => {
    const style = styleById(styleId);
    const rows = (references || []).map((ref) => {
        const csl = cslFor(ref, records);
        const r = normalizeCsl(csl);
        return { ref, csl, r, number: Number(ref.number), year: r.year ? String(r.year) : 'n.d.' };
    });
    if (style.authorDate) {
        // One author part (unmatched citations have none: they are not grouped) with two papers in a year: 2021a, 2021b, in title order (APA 7 §8.19).
        const groups = new Map();
        rows.filter((row) => row.ref?.pmid || row.r.title).forEach((row) => {
            row.author = authorPart(row.r, style.id);
            const key = `${row.author}|${row.year}`;
            groups.set(key, [...(groups.get(key) || []), row]);
        });
        groups.forEach((group) => {
            if (group.length < 2) return;
            group.sort((a, b) => a.r.title.localeCompare(b.r.title))
                .forEach((row, i) => { row.suffix = String.fromCharCode(97 + (i % 26)); });
        });
    }
    const entries = rows.map((row) => {
        // A citation the pipeline could not tie to a paper (no PMID, no title): the audit's
        // "needs review". Said as such, never formatted as an untitled work, and listed last.
        if (!row.ref?.pmid && !row.r.title) {
            return {
                number: row.number, reference: row.ref, unmatched: true,
                text: 'Not matched to a paper — check this citation before using the review.',
                label: style.authorDate ? `unmatched [${row.number}]` : String(row.number),
                sortKey: String(row.number).padStart(6, '0'),
            };
        }
        let text = formatCitation(style.format, row.csl) || row.r.title || 'Untitled';
        const year = `${row.year}${row.suffix || ''}`;
        if (row.suffix) text = text.replace(`(${row.year})`, `(${year})`);
        const first = row.r.authors[0];
        return {
            number: row.number,
            reference: row.ref,
            text,
            label: style.authorDate ? `${row.author}, ${year}` : String(row.number),
            sortKey: `${(first?.family || first?.literal || row.r.title || '').toLowerCase()}|${year}|${row.r.title.toLowerCase()}`,
        };
    });
    if (style.authorDate) {
        entries.sort((a, b) => (Boolean(a.unmatched) - Boolean(b.unmatched)) || a.sortKey.localeCompare(b.sortKey));
    }
    const byNumber = new Map(entries.map((e) => [e.number, e]));
    const cite = (nums) => {
        if (!style.authorDate) return nums.join(',');
        const labels = [...new Set(nums.map((n) => byNumber.get(n)?.label || String(n)))];
        return labels.sort((a, b) => a.localeCompare(b)).join('; ');
    };
    return { style, entries, byNumber, cite };
};

/**
 * The review's markdown in a style, for the exports: the reference list replaced by the formatted
 * one (numbered for a numeric style, one paragraph per entry for an author-date style) and, for an
 * author-date style, every `[n]` replaced by its "(Author, Year)" citation.
 */
export const styleMarkdown = (markdown, references, records, styleId) => {
    const built = buildStyle(references, records, styleId);
    const text = String(markdown || '');
    const lines = text.split('\n');
    const refAt = lines.findIndex((l) => /^##\s+References\s*$/i.test(l));
    let body = (refAt < 0 ? lines : lines.slice(0, refAt)).join('\n');
    // What follows the list (the pipeline's audit comment) is kept after the new one.
    const tail = refAt < 0 ? [] : lines.slice(refAt + 1).filter((l) => /^\s*<!--/.test(l));
    if (built.style.authorDate) {
        body = body.replace(CITATION_RE, (whole, inner) => `(${built.cite(expandCitation(inner))})`);
    }
    if (!built.entries.length) return text;
    const list = built.style.authorDate
        ? built.entries.map((e) => e.text).join('\n\n')
        : built.entries.map((e) => `${e.number}. ${e.text}`).join('\n');
    return `${body.trimEnd()}\n\n## References\n\n${list}\n${tail.length ? `\n${tail.join('\n')}\n` : ''}`;
};
