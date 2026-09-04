/**
 * The order the References panel puts papers in.
 *
 * BY YEAR, NEWEST FIRST. A reader scanning a reference list wants to know what the current
 * literature says before what the 2015 literature said, so the most recent paper leads.
 *
 * This was the behaviour until 2026-07-15, when `8b23956` ("style updates") flipped the
 * comparator to oldest-first alongside a refactor of its argument shape. Nothing else in that
 * commit suggests the reversal was deliberate.
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
 * Newest first, with unknown years last, and stable within a year.
 *
 * Stability matters: papers sharing a year keep the order the agent chose for them, which is
 * its own relevance judgement and better than an arbitrary reshuffle.
 */
export const compareByYearDescending = (a, b) => {
    const left = getReferenceYear(a?.year);
    const right = getReferenceYear(b?.year);
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return right - left;
};

/** Most-cited first. Anything that is not a number — `N/A` on an enriched row — goes last. */
export const compareByCitationsDescending = (a, b) => {
    const left = Number(a?.citation_count);
    const right = Number(b?.citation_count);
    const leftValue = Number.isFinite(left) ? left : -1;
    const rightValue = Number.isFinite(right) ? right : -1;
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
        : compareByYearDescending;
    items.sort(({ reference: a }, { reference: b }) => compare(a, b));
    return items;
};

export default sortReferences;
