/**
 * The investigate funnel counters (Retrieved / Screened / Extracted / Cited).
 *
 * These are cumulative stage counts, and they are the most scrutinised numbers on the panel — a
 * user watching Retrieved jump to 9,000 and then settle back to 3,000 has no reason to trust any
 * of the other figures. That is exactly what happened: numbers were also regex-scraped out of raw
 * tool-log lines and merged in last-write-wins, so a stray figure in unrelated tool output could
 * overwrite the agent's real count in either direction.
 *
 * The scraper is gone. This pins the remaining rule: a counter may appear and may grow, and never
 * shrinks — whatever the arrival order of the frames.
 */
import { mergeFunnel } from './funnel';

const empty = { retrieved: null, screened: null, extracted: null, cited: null };

describe('mergeFunnel', () => {
    it('fills in a value that was previously unknown', () => {
        expect(mergeFunnel(empty, { ...empty, retrieved: 4780 }).retrieved).toBe(4780);
    });

    it('lets a counter grow', () => {
        const a = mergeFunnel(empty, { ...empty, screened: 16 });
        expect(mergeFunnel(a, { ...empty, screened: 53 }).screened).toBe(53);
    });

    it('refuses to let a counter shrink', () => {
        const a = mergeFunnel(empty, { ...empty, retrieved: 9000 });
        expect(mergeFunnel(a, { ...empty, retrieved: 3000 }).retrieved).toBe(9000);
    });

    it('is order-independent', () => {
        const forwards = mergeFunnel(mergeFunnel(empty, { ...empty, cited: 19 }), { ...empty, cited: 25 });
        const backwards = mergeFunnel(mergeFunnel(empty, { ...empty, cited: 25 }), { ...empty, cited: 19 });
        expect(forwards.cited).toBe(backwards.cited);
    });

    it('leaves the other counters alone', () => {
        const a = mergeFunnel(empty, { ...empty, retrieved: 4780, screened: 62 });
        const b = mergeFunnel(a, { ...empty, extracted: 27 });
        expect(b).toEqual({ retrieved: 4780, screened: 62, extracted: 27, cited: null });
    });

    it('treats a missing frame as a no-op', () => {
        const a = mergeFunnel(empty, { ...empty, retrieved: 100 });
        expect(mergeFunnel(a, null)).toEqual(a);
        expect(mergeFunnel(a, undefined)).toEqual(a);
    });

    it('keeps a real zero rather than treating it as unknown', () => {
        // 0 conflicted claims is a fact; it must not read as "not known yet".
        const a = mergeFunnel(empty, { ...empty, cited: 0 });
        expect(a.cited).toBe(0);
        expect(mergeFunnel(a, { ...empty, cited: 3 }).cited).toBe(3);
    });
});
