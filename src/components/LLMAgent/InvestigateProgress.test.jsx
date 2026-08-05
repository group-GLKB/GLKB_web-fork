/**
 * Investigate progress panel behaviour.
 *
 * The panel is what the user stares at for the ~10 minutes a Deep Research run takes, so the
 * properties worth pinning are the ones that make it read as honest and alive:
 *   * it shows something the moment it mounts (before any SSE frame arrives);
 *   * an unknown number is an en dash, never a zero;
 *   * completed steps are past tense, exactly one step is expanded, and it is the active one;
 *   * the bar only ever moves forward, and keeps moving between progress frames.
 */
import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import InvestigateProgress, { formatElapsed } from './InvestigateProgress';
import { PHASE_PERCENT_FLOOR } from '../../service/investigatePhases';

const setup = (props = {}) => render(
    <InvestigateProgress
        phase="planning"
        funnel={{ retrieved: null, screened: null, extracted: null, cited: null }}
        percent={PHASE_PERCENT_FLOOR.planning}
        keywords={[]}
        papers={[]}
        detail={{}}
        label=""
        expanded
        {...props}
    />,
);

const barWidth = () => parseFloat(document.querySelector('.ip-bar-fill').style.width);
const stepTexts = () => Array.from(document.querySelectorAll('.ip-step-label')).map((n) => n.textContent);

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

// ── mounts alive ────────────────────────────────────────────────────────────────────────────
describe('on mount, before any progress frame', () => {
    it('already shows a phase, a bar and the four counters', () => {
        setup();
        expect(screen.getByText('Investigating...')).toBeInTheDocument();
        expect(document.querySelector('.ip-bar-fill')).toBeInTheDocument();
        ['Retrieved', 'Screened', 'Extracted', 'Cited'].forEach((l) =>
            expect(screen.getByText(l)).toBeInTheDocument());
    });

    it('starts the bar above zero', () => {
        setup();
        expect(barWidth()).toBeGreaterThan(0);
    });

    it('shows the first step row immediately', () => {
        setup();
        expect(stepTexts()).toEqual(['Planning the investigation']);
    });

    it('shows the elapsed clock and the notify control', () => {
        setup();
        expect(document.querySelector('.ip-elapsed').textContent).toContain('0:00');
        expect(screen.getByRole('button', { name: /notify me/i })).toBeInTheDocument();
    });
});

// ── elapsed clock ───────────────────────────────────────────────────────────────────────────
/**
 * The header used to carry a hardcoded per-phase ETA ("~6 min") that stepped only when the phase
 * changed — so it sat frozen for minutes beside a moving bar, and its ladder never matched a
 * measured run. It now counts up from the moment the query was sent.
 */
describe('elapsed clock', () => {
    const clock = () => document.querySelector('.ip-elapsed').textContent;

    it('counts up as the run proceeds', () => {
        setup({ startedAt: Date.now() });
        act(() => { jest.advanceTimersByTime(65_000); });
        expect(clock()).toContain('1:05');
    });

    it('pads the seconds and lets the minutes past 59', () => {
        setup({ startedAt: Date.now() });
        act(() => { jest.advanceTimersByTime(9_000); });
        expect(clock()).toContain('0:09');
        act(() => { jest.advanceTimersByTime(60 * 60_000); });
        expect(clock()).toContain('60:09');
    });

    it('measures from the run start, not from when the panel mounted', () => {
        // The panel remounts on re-render; a clock anchored to mount time would restart at 0:00
        // mid-run and contradict the "Investigated for m:ss" row that follows it.
        setup({ startedAt: Date.now() - 90_000 });
        expect(clock()).toContain('1:30');
    });

    it('freezes at the final time once the run is done', () => {
        setup({ startedAt: Date.now(), done: true });
        act(() => { jest.advanceTimersByTime(30_000); });
        expect(clock()).toContain('0:00');
    });

    it('falls back to mount time when no start is given', () => {
        // Never `Date.now() - 0`, which would read as ~56 years.
        setup();
        act(() => { jest.advanceTimersByTime(3_000); });
        expect(clock()).toContain('0:03');
    });
});

describe('formatElapsed', () => {
    // Shared with the "Investigated for m:ss" summary row in index.jsx, so the live clock and the
    // figure the user is left with cannot drift apart.
    it('truncates rather than rounds', () => {
        // 473.9s must print the 7:53 the clock last showed, not 7:54.
        expect(formatElapsed(473.9)).toBe('7:53');
        expect(formatElapsed(0.99)).toBe('0:00');
    });

    it('pads seconds and leaves minutes uncapped', () => {
        expect(formatElapsed(9)).toBe('0:09');
        expect(formatElapsed(60)).toBe('1:00');
        expect(formatElapsed(4400)).toBe('73:20');
    });

    it('never prints a negative or a NaN clock', () => {
        expect(formatElapsed(-5)).toBe('0:00');
        expect(formatElapsed(NaN)).toBe('0:00');
        expect(formatElapsed(undefined)).toBe('0:00');
    });
});

// ── counters ────────────────────────────────────────────────────────────────────────────────
describe('counters', () => {
    it('renders an unknown value as an en dash, never as 0', () => {
        setup({ phase: 'planning' });
        const values = Array.from(document.querySelectorAll('.ip-counter-value')).map((n) => n.textContent);
        expect(values).toEqual(['–', '–', '–', '–']);
        expect(values).not.toContain('0');
    });

    it('lands on the real value after the count-up finishes', () => {
        setup({ phase: 'reading', funnel: { retrieved: 1341, screened: 53, extracted: null, cited: null } });
        act(() => { jest.advanceTimersByTime(2000); });
        const values = Array.from(document.querySelectorAll('.ip-counter-value')).map((n) => n.textContent);
        expect(values[0]).toBe('1,341');
        expect(values[1]).toBe('53');
        expect(values[2]).toBe('–');   // extracted still unknown at this point in the run
    });

    it('applies a later increment without going backwards', () => {
        const { rerender } = setup({ phase: 'writing', funnel: { retrieved: 1341, screened: 53, extracted: 20, cited: 16 } });
        act(() => { jest.advanceTimersByTime(2000); });
        rerender(
            <InvestigateProgress
                phase="writing"
                funnel={{ retrieved: 1341, screened: 53, extracted: 20, cited: 17 }}
                percent={70}
                keywords={[]}
                papers={[]}
                detail={{}}
                label=""
                expanded
            />,
        );
        act(() => { jest.advanceTimersByTime(2000); });
        const values = Array.from(document.querySelectorAll('.ip-counter-value')).map((n) => n.textContent);
        expect(values[3]).toBe('17');
    });
});

// ── step rows ───────────────────────────────────────────────────────────────────────────────
describe('step rows', () => {
    it('shows every phase reached so far, in run order', () => {
        setup({ phase: 'analyzing', funnel: { retrieved: 1341, screened: 53, extracted: 20, cited: null },
            detail: { nClaims: 9, nFacets: 11, facets: ['a', 'b'] } });
        expect(stepTexts()).toEqual([
            'Planned the investigation',
            'Searched the literature',
            'Read 53 papers',
            'Organizing the evidence into 9 claims across 11 topic facets',
        ]);
    });

    it('uses the agent\'s true facet count, not the truncated display list', () => {
        // the agent caps `facets` at 12 for payload size but sends `n_facets` alongside
        setup({ phase: 'analyzing', funnel: { retrieved: 1, screened: 1, extracted: 1, cited: null },
            detail: { nClaims: 9, nFacets: 17, facets: ['a', 'b', 'c'] } });
        expect(stepTexts()).toContain('Organizing the evidence into 9 claims across 17 topic facets');
    });

    it('puts completed rows in the past tense and the active row in the present', () => {
        setup({ phase: 'reading', funnel: { retrieved: 1341, screened: 53, extracted: null, cited: null } });
        const texts = stepTexts();
        expect(texts).toContain('Searched the literature');   // done
        expect(texts).toContain('Reading 53 papers');         // active
        expect(texts).not.toContain('Read 53 papers');
    });

    it('keeps the screening step in the searching row, with its own label', () => {
        // md T2: the row does not advance, only its label changes.
        setup({ phase: 'screening', funnel: { retrieved: 1341, screened: null, extracted: null, cited: null } });
        expect(stepTexts()).toEqual(['Planned the investigation', 'Narrowing down by relevance']);
    });

    it('expands exactly one detail block, under the active row', () => {
        setup({ phase: 'analyzing', funnel: { retrieved: 1341, screened: 53, extracted: 20, cited: null },
            detail: { nClaims: 9, nConflicted: 0, facets: ['a', 'b'] } });
        const details = document.querySelectorAll('.ip-step-detail');
        expect(details).toHaveLength(1);
        const active = document.querySelector('.ip-step.active');
        expect(within(active).getByText(/Number of claims: 9/)).toBeInTheDocument();
    });

    it('leaves no step expanded once the run is done', () => {
        setup({ phase: 'summary', done: true,
            funnel: { retrieved: 1341, screened: 53, extracted: 20, cited: 17 } });
        expect(document.querySelectorAll('.ip-step-detail')).toHaveLength(0);
        expect(document.querySelectorAll('.ip-step.active')).toHaveLength(0);
        // no row is left in its present-tense (in-progress) wording
        const presentTense = /^(Planning|Searching|Narrowing|Reading|Organizing|Writing|Verifying|Polishing)\b/;
        expect(stepTexts().filter((t) => presentTense.test(t))).toEqual([]);
        expect(stepTexts()).toContain('Wrote the 6-section investigation report');
    });
});

// ── detail content ──────────────────────────────────────────────────────────────────────────
describe('detail block', () => {
    const searchingProps = {
        phase: 'searching',
        label: 'Searched the literature — 1341 candidate papers found for: KRAS, TP53',
        detail: { topic: ['KRAS mutation frequency', 'TP53 loss-of-function'] },
        keywords: ['SoupX ambient RNA', 'CellBender', 'DecontX', 'Scrublet', 'Harmony'],
    };

    it('shows the agent label and the topic while searching', () => {
        setup(searchingProps);
        const d = document.querySelector('.ip-step-detail');
        expect(within(d).getByText(/1341 candidate papers found/)).toBeInTheDocument();
        expect(within(d).getByText(/Topic: KRAS mutation frequency/)).toBeInTheDocument();
    });

    it('shows one topic or search at a time rather than the whole list', () => {
        // The searching phase can run for minutes between progress frames; a static block reads as
        // frozen, so topics and queries rotate through one slot instead. Rendering them all at
        // once also pushed the "show all" control below the fold.
        setup(searchingProps);
        expect(document.querySelectorAll('.ip-cycle .ip-detail-bullet')).toHaveLength(1);
    });

    it('rotates to the next search on its own', () => {
        setup(searchingProps);
        const shown = () => document.querySelector('.ip-cycle').textContent;
        const first = shown();
        act(() => { jest.advanceTimersByTime(2200); });
        expect(shown()).not.toBe(first);
    });

    it('offers a way to read everything at once, and stops rotating while open', () => {
        setup(searchingProps);                       // 2 topics + 5 queries
        fireEvent.click(screen.getByRole('button', { name: /show all 7 topics & searches/i }));
        const d = document.querySelector('.ip-step-detail');
        expect(document.querySelectorAll('.ip-cycle .ip-detail-bullet')).toHaveLength(7);
        expect(d).toHaveClass('expanded');           // and the line clamp opens with it

        const all = document.querySelector('.ip-cycle').textContent;
        act(() => { jest.advanceTimersByTime(3000); });
        expect(document.querySelector('.ip-cycle').textContent).toBe(all);

        fireEvent.click(screen.getByRole('button', { name: /show less/i }));
        expect(document.querySelectorAll('.ip-cycle .ip-detail-bullet')).toHaveLength(1);
    });

    it('leads with the probes that have finished, newest information first', () => {
        // The stretch between the plan landing and the pool being fused is minutes long, and the
        // finished probes are the only thing that changes during it.
        setup({
            ...searchingProps,
            detail: {
                topic: ['t1'],
                channels: [
                    { name: 'Vector search over abstracts', hits: 180, ok: true },
                    { name: 'Knowledge-graph expansion', hits: 95, ok: true },
                ],
            },
        });
        const first = document.querySelector('.ip-cycle').textContent;
        expect(first).toMatch(/Vector search over abstracts/);
        expect(first).toMatch(/180 hits/);
    });

    it('says so when a probe came back empty rather than hiding it', () => {
        setup({
            ...searchingProps,
            detail: {
                topic: [],
                channels: [{ name: 'Knowledge-graph expansion', hits: 0, ok: false }],
            },
        });
        expect(document.querySelector('.ip-cycle').textContent).toMatch(/unavailable/);
    });

    it('keeps the "show all" control visible instead of hiding it under a long topic', () => {
        // A joined topic paragraph used to wrap past the block's fixed height and bury both the
        // rotating item and this button.
        setup({
            ...searchingProps,
            detail: { topic: ['A very long topic line '.repeat(12).trim(), 'second topic'] },
        });
        expect(screen.getByRole('button', { name: /show all/i })).toBeInTheDocument();
        expect(document.querySelectorAll('.ip-cycle .ip-detail-bullet')).toHaveLength(1);
    });

    it('shows two papers at a time while reading, and links them to PubMed', () => {
        setup({
            phase: 'reading',
            funnel: { retrieved: 1341, screened: 4, extracted: null, cited: null },
            papers: [
                { pmid: '36711819', title: 'Computational workflow', journal: 'bioRxiv', year: 2023 },
                { pmid: '32375897', title: 'Single-cell RNA-seq', journal: 'Genome Biol', year: 2020 },
                { pmid: '29433196', title: 'Comprehensive genomic characterization', journal: 'Nature', year: 2017 },
                { pmid: '31068700', title: 'Germline BRCA1/2', journal: 'J Clin Oncol', year: 2019 },
            ],
        });
        const d = document.querySelector('.ip-step-detail');
        expect(within(d).getAllByRole('link')).toHaveLength(2);
        expect(within(d).getByText(/Computational workflow/)).toBeInTheDocument();
        expect(within(d).queryByText(/Comprehensive genomic/)).not.toBeInTheDocument();
        expect(within(d).getByRole('link', { name: '[36711819]' }))
            .toHaveAttribute('href', 'https://pubmed.ncbi.nlm.nih.gov/36711819/');
    });

    it('lists the report sections while writing', () => {
        setup({ phase: 'writing', funnel: { retrieved: 1, screened: 1, extracted: 1, cited: 1 },
            detail: { section: 'Conflict analysis', step: 2, totalSections: 6 } });
        const d = document.querySelector('.ip-step-detail');
        expect(within(d).getByText(/Sections: Direct answer/)).toBeInTheDocument();
        expect(within(d).getByText(/Drafting Conflict analysis \(2\/6\)/)).toBeInTheDocument();
    });

    it('shows no detail block for phases that have none', () => {
        setup({ phase: 'verifying', funnel: { retrieved: 1, screened: 1, extracted: 1, cited: 1 } });
        expect(document.querySelectorAll('.ip-step-detail')).toHaveLength(0);
    });
});

// ── header ──────────────────────────────────────────────────────────────────────────────────
describe('header', () => {
    it('drops the ETA once the run is done, keeping the notify control', () => {
        setup({ phase: 'summary', done: true,
            funnel: { retrieved: 1341, screened: 53, extracted: 20, cited: 17 } });
        expect(screen.queryByText(/min$/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /notify/i })).toBeInTheDocument();
    });

    it('says "Report ready" at the end', () => {
        setup({ phase: 'summary', done: true,
            funnel: { retrieved: 1341, screened: 53, extracted: 20, cited: 17 } });
        act(() => { jest.advanceTimersByTime(600); });
        expect(screen.getByText('Report ready')).toBeInTheDocument();
    });

    it('collapses the body but keeps the header when not expanded', () => {
        setup({ expanded: false });
        expect(screen.getByText('Investigating...')).toBeInTheDocument();
        expect(document.querySelector('.ip-body')).not.toBeInTheDocument();
    });
});

// ── bar ─────────────────────────────────────────────────────────────────────────────────────
describe('progress bar', () => {
    it('is full and stops moving when the run is done', () => {
        setup({ phase: 'summary', done: true,
            funnel: { retrieved: 1341, screened: 53, extracted: 20, cited: 17 } });
        expect(barWidth()).toBe(100);
    });

    it('never renders a width outside 0-100', () => {
        setup({ phase: 'verifying', percent: 999,
            funnel: { retrieved: 1, screened: 1, extracted: 1, cited: 1 } });
        const w = barWidth();
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(100);
    });
});

// ── the fake ramp ───────────────────────────────────────────────────────────────────────────
describe('the fake ramp shown before a real number arrives', () => {
    const retrievedText = () => document.querySelectorAll('.ip-counter-value')[0].textContent;
    const screenedText = () => document.querySelectorAll('.ip-counter-value')[1].textContent;
    const num = (t) => Number(String(t).replace(/,/g, ''));

    it('starts at 1, never at 0', () => {
        setup({ phase: 'searching' });
        expect(retrievedText()).toBe('1');
    });

    it('climbs while the phase is in flight and stays inside its ceiling', () => {
        setup({ phase: 'searching' });
        act(() => { jest.advanceTimersByTime(30000); });
        const v = num(retrievedText());
        expect(v).toBeGreaterThan(1);
        expect(v).toBeLessThanOrEqual(2000);   // RAMP_RANGE.retrieved.max
    });

    it('only moves forward', () => {
        setup({ phase: 'searching' });
        const seen = [];
        for (let i = 0; i < 12; i += 1) {
            act(() => { jest.advanceTimersByTime(900); });
            seen.push(num(retrievedText()));
        }
        expect(seen).toEqual([...seen].sort((a, b) => a - b));
    });

    it('does not start for a counter whose phase has not begun', () => {
        setup({ phase: 'searching' });
        act(() => { jest.advanceTimersByTime(5000); });
        expect(screenedText()).toBe('–');       // screening has not started yet
    });

    it('adds the ramp to the real number for Retrieved (product decision)', () => {
        // Note what this means: the figure Retrieved settles on is NOT the number of records the
        // run identified. It is that number plus wherever the ramp had got to. Flip
        // RAMP_RANGE.retrieved.addsToReal to show the measured value alone.
        const { rerender } = setup({ phase: 'searching' });
        act(() => { jest.advanceTimersByTime(20000); });
        const ramped = num(retrievedText());
        expect(ramped).toBeGreaterThan(1);

        rerender(
            <InvestigateProgress
                phase="screening"
                funnel={{ retrieved: 4472, screened: null, extracted: null, cited: null }}
                percent={14}
                keywords={[]}
                papers={[]}
                detail={{}}
                label=""
                expanded
            />,
        );
        act(() => { jest.advanceTimersByTime(3000); });
        expect(num(retrievedText())).toBe(4472 + ramped);
    });

    it('shows the measured value alone for every other counter', () => {
        const { rerender } = setup({ phase: 'screening' });
        act(() => { jest.advanceTimersByTime(20000); });
        expect(num(screenedText())).toBeGreaterThan(1);      // ramping

        rerender(
            <InvestigateProgress
                phase="reading"
                funnel={{ retrieved: null, screened: 53, extracted: null, cited: null }}
                percent={22}
                keywords={[]}
                papers={[]}
                detail={{}}
                label=""
                expanded
            />,
        );
        act(() => { jest.advanceTimersByTime(3000); });
        expect(screenedText()).toBe('53');
    });

    it('carries on from where the ramp got to instead of restarting at zero', () => {
        const { rerender } = setup({ phase: 'searching' });
        act(() => { jest.advanceTimersByTime(20000); });
        const ramped = num(retrievedText());

        rerender(
            <InvestigateProgress
                phase="screening"
                funnel={{ retrieved: 4472, screened: null, extracted: null, cited: null }}
                percent={14}
                keywords={[]}
                papers={[]}
                detail={{}}
                label=""
                expanded
            />,
        );
        act(() => { jest.advanceTimersByTime(60); });   // one frame into the count-up
        expect(num(retrievedText())).toBeGreaterThanOrEqual(ramped);
    });

    it('discards the ramp for columns that do not opt in', () => {
        const { rerender } = setup({ phase: 'screening' });
        act(() => { jest.advanceTimersByTime(20000); });
        expect(num(screenedText())).toBeGreaterThan(1);   // ramping

        rerender(
            <InvestigateProgress
                phase="reading"
                funnel={{ retrieved: null, screened: 53, extracted: null, cited: null }}
                percent={22}
                keywords={[]}
                papers={[]}
                detail={{}}
                label=""
                expanded
            />,
        );
        act(() => { jest.advanceTimersByTime(3000); });
        expect(screenedText()).toBe('53');                 // replaced, not added
    });

    it('is skipped entirely under reduced motion', () => {
        const mql = window.matchMedia;
        window.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {} });
        try {
            setup({ phase: 'searching' });
            act(() => { jest.advanceTimersByTime(20000); });
            expect(retrievedText()).toBe('–');
        } finally {
            window.matchMedia = mql;
        }
    });
});
