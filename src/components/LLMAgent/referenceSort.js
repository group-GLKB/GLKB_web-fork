/**
 * The order the References panel puts papers in.
 *
 * BY YEAR, OLDEST FIRST. This is the bibliography order selected for the product: it makes the
 * development of a claim readable chronologically, while the Citation option remains the way
 * to put the most influential papers first.
 *
 * The comparator also could not survive its own input. `(a.year || 0) - (b.year || 0)` returns
 * NaN for any year that is not a bare number, and a comparator that returns NaN is read as
 * "these two are equal" — so a single unparseable year would not misplace one row, it would
 * turn the whole sort into a no-op and leave the list in whatever order it arrived in, under a
 * control still labelled Year and with nothing on screen to say the sort had stopped working.
 * `year` arrives in more than one shape: a Neo4j integer on the graph path, a four-digit string
 * from the PubMed enrichment, and a full date string (`2019 Mar 15`, `2019-03-15`) from any
 * provider that fills `date` rather than `pubdate`. The sibling Citations comparator was given
 * exactly this guard (`getCitationSortValue`) and the year one was not — a bug met once and
 * fixed on one side only.
 *
 * And `|| 0` decided where an unknown year belongs by accident rather than on purpose. A paper
 * Neo4j could not resolve carries `date: null`; it is not a paper from the year 0, and it goes
 * last whichever way the years are running.
 *
 * Its own module, with no imports, so the rule can be tested without pulling the whole app in.
 */

/* 1600–2099. MEDLINE reaches back to the early 1800s, and a four-digit run inside a date
   string is the only thing here worth reading as a year — a day or a month never has four
   digits, so there is nothing else in these values to collide with. */
const YEAR_IN_TEXT = /\b(1[6-9]\d{2}|20\d{2})\b/;

/**
 * A reference's publication year as a number, or null when it does not name one.
 *
 * Null rather than 0 or NaN: 0 sorts like an ancient paper and NaN poisons the comparator.
 * Null lets the caller decide where "unknown" belongs, which is at the end.
 */
export const getReferenceYear = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (value == null) return null;
    const match = String(value).match(YEAR_IN_TEXT);
    return match ? Number(match[0]) : null;
};

/**
 * Oldest first, with unknown years last, and stable within a year.
 *
 * Stability matters: papers sharing a year keep the order the agent chose for them, which is
 * its own relevance judgement and better than an arbitrary reshuffle.
 */
export const compareByYearAscending = (a, b) => {
    const left = getReferenceYear(a?.year);
    const right = getReferenceYear(b?.year);
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return left - right;
};

/**
 * Citation providers do not agree on a scalar shape. Besides numbers, the API has returned
 * strings such as `1,234`, `1 234`, and `1,234 citations`. Treat those as the count the reader
 * sees; a genuinely missing value (`N/A`, empty, null) still belongs at the end.
 */
export const getCitationSortValue = (value) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (value == null) return null;
    /* Neo4j integers can survive JSON serialization as {low, high}. Counts are non-negative,
       but keep the full 64-bit composition instead of silently sorting only by the low word. */
    if (typeof value === 'object') {
        if (typeof value.toNumber === 'function') {
            try {
                const converted = value.toNumber();
                return Number.isFinite(converted) ? converted : null;
            } catch (error) {
                return null;
            }
        }
        if (Number.isFinite(Number(value.low)) && Number.isFinite(Number(value.high))) {
            return (Number(value.high) * 0x100000000) + (Number(value.low) >>> 0);
        }
        if ('$numberLong' in value) return getCitationSortValue(value.$numberLong);
        return null;
    }
    const normalized = String(value).trim();
    if (!normalized) return null;
    const match = normalized.replace(/[,_\s]/g, '').match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
};

/** Most-cited first. Anything without a readable count goes last. */
export const compareByCitationsDescending = (a, b) => {
    const left = getCitationSortValue(a?.citation_count);
    const right = getCitationSortValue(b?.citation_count);
    const leftValue = left ?? -1;
    const rightValue = right ?? -1;
    return rightValue - leftValue;
};

/**
 * Order references for the panel.
 *
 * Takes and returns `{ reference, originalIndex }` wrappers: the index is the citation number
 * the answer text refers to, so it has to survive the reordering.
 */
export const sortReferences = (wrapped, sortOption) => {
    const items = Array.isArray(wrapped) ? [...wrapped] : [];
    const compare = sortOption === 'Citations'
        ? compareByCitationsDescending
        : compareByYearAscending;
    items.sort(({ reference: a }, { reference: b }) => compare(a, b));
    return items;
};

export default sortReferences;
