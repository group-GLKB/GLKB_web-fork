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
import { act, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import InvestigateProgress from './InvestigateProgress';
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

    it('shows an ETA and the notify control', () => {
        setup();
        expect(screen.getByText(/~6 min/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /notify me/i })).toBeInTheDocument();
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
    it('shows the agent label, the topic and the keyword chips while searching', () => {
        setup({
            phase: 'searching',
            label: 'Searched the literature — 1341 candidate papers found for: KRAS, TP53',
            detail: { topic: ['KRAS mutation frequency', 'TP53 loss-of-function'] },
            keywords: ['SoupX ambient RNA', 'CellBender', 'DecontX', 'Scrublet', 'Harmony'],
        });
        const d = document.querySelector('.ip-step-detail');
        expect(within(d).getByText(/1341 candidate papers found/)).toBeInTheDocument();
        expect(within(d).getByText(/Topic: KRAS mutation frequency/)).toBeInTheDocument();
        expect(within(d).getByText('SoupX ambient RNA')).toBeInTheDocument();
        expect(within(d).getByText('+2 more')).toBeInTheDocument();   // 5 keywords, 3 shown
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

    it('lands on the real number, not on the ramp plus the real number', () => {
        // The ramp is motion only. Retrieved shows PRISMA's "records identified" — already
        // several times the fused pool — so nothing has to be added to make it substantial.
        const { rerender } = setup({ phase: 'searching' });
        act(() => { jest.advanceTimersByTime(20000); });
        expect(num(retrievedText())).toBeGreaterThan(1);

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
        expect(num(retrievedText())).toBe(4472);
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
