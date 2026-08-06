/**
 * The investigate funnel counters (Retrieved / Screened / Extracted / Cited).
 *
 * Its own module, with no imports: `components/LLMAgent/index.jsx` cannot be pulled into a test
 * without dragging the whole app in behind it.
 */

export const emptyFunnel = () => ({ retrieved: null, screened: null, extracted: null, cited: null });

/**
 * Fold a frame's funnel numbers into the running totals. A counter may appear (null -> n) and may
 * grow, but never shrinks: these are cumulative stage counts, so a decrease can only come from a
 * late or out-of-order frame, and a number ticking backwards reads as a bug.
 *
 * Numbers used to be regex-scraped out of raw tool-log lines and merged here last-write-wins,
 * which is how Retrieved could jump to 9,000 and then fall back to 3,000 — a stray figure in
 * unrelated tool output landed near the word "retrieved" and overwrote the agent's real count.
 * That scraper is gone; only the agent's structured fields reach this function.
 */
export const mergeFunnel = (prev, next) => {
    if (!next) return prev || emptyFunnel();
    const base = prev || emptyFunnel();
    const keep = (a, b) => {
        if (b === null || b === undefined) return a;
        if (a === null || a === undefined) return b;
        return Math.max(a, b);
    };
    return {
        retrieved: keep(base.retrieved, next.retrieved),
        screened: keep(base.screened, next.screened),
        extracted: keep(base.extracted, next.extracted),
        cited: keep(base.cited, next.cited),
    };
};
