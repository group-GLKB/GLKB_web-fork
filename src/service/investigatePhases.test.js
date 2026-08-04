/**
 * The phase table is a contract with the agent: the panel's bar, ETA and row tense are all
 * derived from it, and it mirrors the percent ladder in `my_agent/harness/orchestrator.py`.
 * These tests pin the properties that break silently if the two drift apart.
 */
import {
    INVESTIGATE_PHASE_META,
    INVESTIGATE_PHASE_ORDER,
    PHASE_PERCENT_FLOOR,
    phaseIndex,
    phasePercentCap,
} from './investigatePhases';

describe('phase order', () => {
    it('covers every phase the agent can emit', () => {
        // Mirrors the `events.progress(<phase>, ...)` calls in harness/orchestrator.py.
        const emitted = ['planning', 'searching', 'screening', 'reading', 'analyzing',
            'writing', 'verifying', 'finalizing', 'summary'];
        emitted.forEach((p) => expect(INVESTIGATE_PHASE_ORDER).toContain(p));
    });

    it('has a floor and a title for every phase', () => {
        INVESTIGATE_PHASE_ORDER.forEach((p) => {
            expect(PHASE_PERCENT_FLOOR[p]).toEqual(expect.any(Number));
            expect(INVESTIGATE_PHASE_META[p].title).toEqual(expect.any(String));
        });
    });

    it('floors increase monotonically along the run', () => {
        const floors = INVESTIGATE_PHASE_ORDER.map((p) => PHASE_PERCENT_FLOOR[p]);
        expect(floors).toEqual([...floors].sort((a, b) => a - b));
    });

    it('starts above zero so the bar is never empty at submit', () => {
        expect(PHASE_PERCENT_FLOOR.planning).toBeGreaterThan(0);
    });

    it('sorts an unknown phase first rather than last', () => {
        // A phase we do not recognise must never be treated as "later" than a real one, or
        // every completed row would flip to past tense at once.
        expect(phaseIndex('who-knows')).toBe(0);
        expect(phaseIndex('writing')).toBeGreaterThan(phaseIndex('reading'));
    });
});

describe('bar creep ceiling', () => {
    it('never reaches the next phase floor', () => {
        INVESTIGATE_PHASE_ORDER.slice(0, -1).forEach((phase, i) => {
            const next = INVESTIGATE_PHASE_ORDER[i + 1];
            expect(phasePercentCap(phase)).toBeLessThan(PHASE_PERCENT_FLOOR[next]);
        });
    });

    it('is at or above its own phase floor, so the bar can always move', () => {
        INVESTIGATE_PHASE_ORDER.forEach((phase) => {
            expect(phasePercentCap(phase)).toBeGreaterThanOrEqual(PHASE_PERCENT_FLOOR[phase]);
        });
    });

    it('gives the longest phases the most room to creep', () => {
        // reading (compression) and writing (six heavy sections) are the multi-minute phases;
        // if their cap were tight the bar would freeze exactly where it is most conspicuous.
        expect(phasePercentCap('reading') - PHASE_PERCENT_FLOOR.reading).toBeGreaterThanOrEqual(10);
        expect(phasePercentCap('writing') - PHASE_PERCENT_FLOOR.writing).toBeGreaterThanOrEqual(10);
    });

    it('tops out at 100 on the terminal phase and handles junk input', () => {
        expect(phasePercentCap('summary')).toBe(100);
        expect(phasePercentCap('nonsense')).toBe(99);
        expect(phasePercentCap(undefined)).toBe(99);
    });
});

describe('ETA ladder', () => {
    it('matches the measured recording: 6 / 5 / 4 / 2 / 1, with 3 skipped', () => {
        expect(INVESTIGATE_PHASE_META.searching.etaMin).toBe(6);
        expect(INVESTIGATE_PHASE_META.reading.etaMin).toBe(5);
        expect(INVESTIGATE_PHASE_META.analyzing.etaMin).toBe(4);
        expect(INVESTIGATE_PHASE_META.writing.etaMin).toBe(2);
        expect(INVESTIGATE_PHASE_META.verifying.etaMin).toBe(1);
        const shown = INVESTIGATE_PHASE_ORDER.map((p) => INVESTIGATE_PHASE_META[p].etaMin);
        expect(shown).not.toContain(3);
    });

    it('never increases as the run proceeds', () => {
        const etas = INVESTIGATE_PHASE_ORDER.map((p) => INVESTIGATE_PHASE_META[p].etaMin);
        expect(etas).toEqual([...etas].sort((a, b) => b - a));
    });

    it('reaches zero only at the end, where the element unmounts', () => {
        expect(INVESTIGATE_PHASE_META.summary.etaMin).toBe(0);
        INVESTIGATE_PHASE_ORDER.slice(0, -1).forEach((p) => {
            expect(INVESTIGATE_PHASE_META[p].etaMin).toBeGreaterThan(0);
        });
    });
});
