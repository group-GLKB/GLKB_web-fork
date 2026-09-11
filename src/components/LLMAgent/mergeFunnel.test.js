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
import { mergeFunnel, settleFunnel } from './funnel';

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

/**
 * What a finished message keeps.
 *
 * The reported bug: Retrieved fell by thousands the instant a run ended. The panel had been
 * showing `agent count + ramp`; the summary chips that replace it read the agent count alone.
 * Both numbers are legitimate — they are just not the same number, and the smaller one must
 * not be the one the reader is left with.
 */
describe('settleFunnel', () => {
    const agent = { retrieved: 1300, screened: 53, extracted: 18, cited: 12 };

    it('keeps the displayed figure when the panel showed more', () => {
        // The exact reported case: the counter was on 4,100, the agent had reported 1,300.
        const displayed = { ...empty, retrieved: 4100 };
        expect(settleFunnel(agent, displayed).retrieved).toBe(4100);
    });

    it('keeps the agent figure when it is the larger one', () => {
        const displayed = { ...empty, screened: 20 };
        expect(settleFunnel(agent, displayed).screened).toBe(53);
    });

    it('settles every column independently', () => {
        const displayed = { retrieved: 4100, screened: 20, extracted: 25, cited: null };
        expect(settleFunnel(agent, displayed)).toEqual({
            retrieved: 4100,   // display won
            screened: 53,      // agent won
            extracted: 25,     // display won
            cited: 12,         // display had nothing
        });
    });

    it('survives a run that displayed nothing', () => {
        expect(settleFunnel(agent, empty)).toEqual(agent);
    });

    it('survives an agent that reported nothing', () => {
        const displayed = { ...empty, retrieved: 2800 };
        expect(settleFunnel(empty, displayed).retrieved).toBe(2800);
    });

    it('never returns a value below either input', () => {
        const displayed = { retrieved: 4100, screened: 20, extracted: 25, cited: 3 };
        const out = settleFunnel(agent, displayed);
        Object.keys(out).forEach((key) => {
            expect(out[key]).toBeGreaterThanOrEqual(agent[key] ?? 0);
            expect(out[key]).toBeGreaterThanOrEqual(displayed[key] ?? 0);
        });
    });
});
