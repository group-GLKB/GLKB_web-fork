/**
 * The order the References panel puts papers in.
 *
 * BY YEAR, OLDEST FIRST. A reference list read top to bottom is a story about how the finding
 * developed, so it starts at the beginning.
 *
 * The comparator this replaces was `(a.year || 0) - (b.year || 0)`, and it had two faults.
 *
 * It returned NaN for any year that was not a bare number, and a comparator that returns NaN
 * is treated as "these two are equal" — so a single unparseable year did not just misplace one
 * row, it silently turned the whole sort into a no-op. What the reader then saw was the order
 * the agent had sent, which is `ORDER BY coalesce(a.pubdate, 0) DESC` (glkb-agent
 * `my_agent/tools.py`): newest first, the exact opposite of what the control says it does, and
 * with nothing on screen to suggest the sort had stopped working. `year` arrives in more than
 * one shape — a Neo4j integer on the graph path, a four-digit string from the PubMed
 * enrichment, and a full date string (`2019 Mar 15`, `2019-03-15`) from any provider that
 * fills `date` rather than `pubdate` — so this was reachable, not theoretical. The sibling
 * Citations comparator was given exactly this guard (`getCitationSortValue`) and the year one
 * was not, which is the shape of a bug someone met once and fixed on one side only.
 *
 * And `|| 0` sent a reference with no year to the FRONT: a paper Neo4j could not resolve
 * carries `date: null`, and undated rows led the list ahead of every real paper. An unknown
 * year is not the year 0; it goes last.
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
 * Stability matters: papers from the same year keep the order the agent chose for them, which
 * is its own relevance judgement and better than an arbitrary reshuffle.
 */
export const compareByYearAscending = (a, b) => {
    const left = getReferenceYear(a?.year);
    const right = getReferenceYear(b?.year);
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return left - right;
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
        : compareByYearAscending;
    items.sort(({ reference: a }, { reference: b }) => compare(a, b));
    return items;
};

export default sortReferences;
