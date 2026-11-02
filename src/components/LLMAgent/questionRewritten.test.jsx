/**
 * How an Investigate follow-up was interpreted.
 *
 * Before anything else runs, deep research resolves a follow-up ("and in mice?") into a
 * standalone question, and the whole report answers THAT question. The agent says so with a
 * frame of its own (glkb-agent service/api.py):
 *
 *   { step: 'Interpreting the question', type: 'question_rewritten', original, question }
 *
 * It used to become an empty step, so a misread follow-up surfaced only when the report landed,
 * minutes later. Pinned here:
 *   * the frame becomes "Interpreted as: <question>" — a line in the thoughts, and a standing
 *     line on the progress panel for the rest of the run;
 *   * the question's own words never move the run's phase;
 *   * a reloaded investigation, replayed from its stored trace, keeps the line.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import InvestigateProgress from './InvestigateProgress';
import { mergeInvestigateDetail, replayTrace } from './traceReplay';
import stepLabels from './step.json';
import { frameToUpdate } from '../../service/LLMAgent';
import { PHASE_PERCENT_FLOOR } from '../../service/investigatePhases';

const REWRITE = {
    step: 'Interpreting the question',
    type: 'question_rewritten',
    original: 'and what papers analyze it in mice?',
    question: 'What papers analyze the role of NR4A1 in T-cell exhaustion in mouse models?',
};

describe('the question_rewritten frame', () => {
    it('becomes a visible line, and a standing detail for the panel', () => {
        const update = frameToUpdate(REWRITE);
        expect(update).toEqual(expect.objectContaining({
            type: 'step',
            step: 'Interpreting the question',
            content: `Interpreted as: ${REWRITE.question}`,
            isProgress: false,
        }));
        expect(update.detail).toEqual({
            interpreted_as: REWRITE.question,
            original_question: REWRITE.original,
        });
    });

    it("pins the phase to planning — the question's words ('papers', 'analyze') are not the run's", () => {
        expect(frameToUpdate(REWRITE).phase).toBe('planning');
    });

    it('says nothing when there is nothing to say', () => {
        const update = frameToUpdate({ ...REWRITE, question: '  ' });
        expect(update.content).toBe('');
        expect(update.detail).toEqual({});
    });

    it('is kept by the panel detail across the frames that follow it', () => {
        let detail = mergeInvestigateDetail({}, frameToUpdate(REWRITE).detail, '');
        detail = mergeInvestigateDetail(detail, { topic: ['NR4A1'] }, 'Searching 3 facets');
        detail = mergeInvestigateDetail(detail, {}, 'Reading 40 papers');
        expect(detail.interpretedAs).toBe(REWRITE.question);
        expect(detail.label).toBe('Reading 40 papers');
    });

    it('groups under its own heading in the thoughts', () => {
        expect(stepLabels['Interpreting the question']).toBe('Interpreting the question');
    });
});

describe('a reloaded investigation', () => {
    it('replays the line from its stored trace, without moving the phase on', () => {
        const trace = (frames) => ({
            v: 1, mode: 'investigate', complete: false, duration_ms: 20000, frames,
        });
        const STARTED = { step: 'Started', run_id: 'dr-1', session_id: 'web_dr_1', phase: 'planning' };
        const out = replayTrace(trace([STARTED, REWRITE]));
        expect(out.thinkingSteps).toEqual([
            { step: 'Interpreting the question', content: `Interpreted as: ${REWRITE.question}` },
        ]);
        expect(out.investigatePhase).toBe('planning');
        // Exactly where the run stood without it.
        expect(out.investigatePercent).toBe(replayTrace(trace([STARTED])).investigatePercent);
    });
});

describe('the progress panel', () => {
    const panel = (props = {}) => (
        <InvestigateProgress
            phase="searching"
            funnel={{ retrieved: null, screened: null, extracted: null, cited: null }}
            percent={PHASE_PERCENT_FLOOR.searching}
            keywords={[]}
            papers={[]}
            detail={{}}
            label=""
            expanded
            {...props}
        />
    );

    beforeEach(() => { jest.useFakeTimers(); });
    afterEach(() => {
        act(() => { jest.runOnlyPendingTimers(); });
        jest.useRealTimers();
    });

    it('shows how the follow-up was read, for the rest of the run', () => {
        const { rerender } = render(panel({ detail: { interpretedAs: REWRITE.question } }));
        const line = screen.getByText('Interpreted as:').closest('p');
        expect(line).toHaveTextContent(`Interpreted as: ${REWRITE.question}`);
        // Still there when the run moves on, and when the panel is collapsed.
        rerender(panel({ phase: 'reading', detail: { interpretedAs: REWRITE.question, label: 'Reading' }, expanded: false }));
        expect(screen.getByText('Interpreted as:').closest('p')).toBeVisible();
    });

    it('shows no such line for a first question, which nothing rewrote', () => {
        render(panel());
        expect(screen.queryByText('Interpreted as:')).toBeNull();
    });
});

describe('the live run on the chat page', () => {
    // Glue inside the chat page's stream handler, asserted in the source as the wiring tests do.
    const source = readFileSync(join(__dirname, 'index.jsx'), 'utf-8');

    it("folds the frame's detail into the panel's, and gives the panel that detail", () => {
        expect(source).toMatch(/investigateDetailRef\.current = mergeInvestigateDetail\(\s*investigateDetailRef\.current,\s*update\.detail,/);
        expect(source).toContain('detail={investigateDetail}');
    });

    it('keeps its line in the thoughts the finished report carries', () => {
        expect(source).toMatch(/if \(hasContent && !update\.isProgress\) \{\s*const newEntry = \{ step: update\.step, content: rawContent \};/);
    });
});
