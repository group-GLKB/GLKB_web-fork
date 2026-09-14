/**
 * `extractProgress` — the live position of a run, read back from `GET /run`.
 *
 * A reader who reloads, or opens the conversation on another device, is no longer on the SSE
 * the progress frames travel down. The poll that replaces it used to answer "still running"
 * and nothing more, so the panel sat on whatever the tab had saved — frozen at the phase and
 * the counters of the moment the page went away — or, with nothing saved, empty at zero, for
 * the rest of a run that can take fifteen minutes.
 *
 * The agent folds its frames into the run record now; this reads that snapshot back through
 * the same extractors the stream uses, so the two routes cannot disagree.
 */
import { extractProgress } from './LLMAgent';

const snapshot = {
    phase: 'writing',
    label: 'Writing the report — Direct answer (4/6)',
    step: 'Writing the report',
    percent: 58,
    started_at: 1789000000,
    updated_at: 1789000123,
    detail: {
        retrieved: 1621,
        screened: 180,
        extracted: 96,
        cited_provisional: 27,
        queries: ['EGFR NSCLC targeted therapy'],
        papers: [{ pmid: '31234567', title: 'Osimertinib in EGFR-mutated NSCLC' }],
        section: 'Direct answer',
    },
};

describe('the progress a reattached view draws from', () => {
    it('reads the funnel the agent merged across phases', () => {
        const progress = extractProgress(snapshot);
        expect(progress.funnel).toEqual({
            retrieved: 1621, screened: 180, extracted: 96, cited: 27,
        });
    });

    it('carries the phase, the bar and the step label', () => {
        const progress = extractProgress(snapshot);
        expect(progress.phase).toBe('writing');
        expect(progress.percent).toBe(58);
        expect(progress.label).toBe('Writing the report — Direct answer (4/6)');
    });

    it('converts the run start to the clock the panel counts in', () => {
        // The agent reports epoch SECONDS; a header showing 1789000000ms of elapsed time
        // would be the bug this field exists to fix, in the other direction.
        expect(extractProgress(snapshot).startedAt).toBe(1789000000000);
        expect(extractProgress({ ...snapshot, started_at: undefined }).startedAt).toBeNull();
    });

    it('keeps the keywords and the papers being read', () => {
        const progress = extractProgress(snapshot);
        expect(progress.keywords).toEqual(['EGFR NSCLC targeted therapy']);
        expect(progress.papers[0].pmid).toBe('31234567');
    });

    it('hands the rest of the detail through for the step block', () => {
        expect(extractProgress(snapshot).detail.section).toBe('Direct answer');
    });

    it('is null for a run with no progress yet, and for anything malformed', () => {
        expect(extractProgress(null)).toBeNull();
        expect(extractProgress(undefined)).toBeNull();
        expect(extractProgress('running')).toBeNull();
    });

    it('reports nothing rather than zero for counters the run has not reached', () => {
        // `–` on the panel means "not yet", and 0 would be a claim the run never made.
        const early = extractProgress({ phase: 'searching', percent: 6, detail: { retrieved: 12 } });
        expect(early.funnel).toEqual({
            retrieved: 12, screened: null, extracted: null, cited: null,
        });
    });
});
