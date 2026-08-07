/**
 * Clarify panel behaviour — Figma "Asking Question" (node 111:4385).
 *
 * The properties worth pinning are the ones a redesign can quietly break:
 *   * the footer is Skip until something is answered and Submit after (the design's own two
 *     state frames), and both still reach their handlers;
 *   * single-select replaces, multi-select accumulates;
 *   * "Other" is always offered and typing in it counts as an answer;
 *   * the draft shape handed back to the container is unchanged, so the submit path that talks
 *     to /clarify keeps working.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ClarifyPanel } from './ClarifyPanel';

const QUESTION = {
    header: 'Disease',
    question: 'Which disease should the review focus on?',
    response_type: 'single',
    options: [
        { label: 'Type 1 diabetes', description: 'Autoimmune beta-cell destruction.' },
        { label: 'Type 2 diabetes', description: 'Insulin resistance and beta-cell failure.' },
    ],
};

const setup = (props = {}) => {
    const onUpdateDraft = jest.fn();
    const onSubmit = jest.fn();
    const onSkip = jest.fn();
    const utils = render(
        <ClarifyPanel
            pendingClarification={{ questions: [QUESTION] }}
            clarificationDrafts={{}}
            clarificationError=""
            clarificationSubmitting={false}
            hasInvalidOtherSelection={false}
            onUpdateDraft={onUpdateDraft}
            onSubmit={onSubmit}
            onSkip={onSkip}
            {...props}
        />,
    );
    return { ...utils, onUpdateDraft, onSubmit, onSkip };
};

const drafts = (selected = [], text = '', otherSelected = false) => ({
    Disease: { selected, text, otherSelected },
});

describe('rendering', () => {
    it('shows the question, its numbered options and their descriptions', () => {
        setup();
        expect(screen.getByText('Which disease should the review focus on?')).toBeInTheDocument();
        const rows = document.querySelectorAll('.clarify-option:not(.clarify-other)');
        expect(rows).toHaveLength(2);
        expect(within(rows[0]).getByText('1.')).toBeInTheDocument();
        expect(within(rows[0]).getByText('Type 1 diabetes')).toBeInTheDocument();
        expect(within(rows[0]).getByText(/Autoimmune beta-cell destruction/)).toBeInTheDocument();
        expect(within(rows[1]).getByText('2.')).toBeInTheDocument();
    });

    it('always offers Other with a free-text input', () => {
        setup();
        expect(screen.getByText('Other')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Type your own answer here')).toBeInTheDocument();
    });

    it('marks the chosen row selected and leaves the others alone', () => {
        setup({ clarificationDrafts: drafts(['Type 1 diabetes']) });
        const rows = document.querySelectorAll('.clarify-option:not(.clarify-other)');
        expect(rows[0]).toHaveClass('selected');
        expect(rows[0]).toHaveAttribute('aria-checked', 'true');
        expect(rows[1]).not.toHaveClass('selected');
    });
});

// The design shows Skip on the untouched panel (111:4438) and Submit once an answer exists
// (111:4845) — one button, not two.
describe('the footer button', () => {
    it('is Skip while nothing is answered, and skips', () => {
        const { onSkip } = setup();
        expect(screen.queryByRole('button', { name: /^submit/i })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
        expect(onSkip).toHaveBeenCalled();
    });

    it('becomes Submit once an option is chosen, and submits', () => {
        const { onSubmit } = setup({ clarificationDrafts: drafts(['Type 2 diabetes']) });
        expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /submit/i }));
        expect(onSubmit).toHaveBeenCalled();
    });

    it('becomes Submit on typed Other text, but not on an empty Other tick', () => {
        setup({ clarificationDrafts: drafts([], '', true) });
        expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();

        setup({ clarificationDrafts: drafts([], 'gestational diabetes', true) });
        expect(screen.getAllByRole('button', { name: /submit/i }).length).toBeGreaterThan(0);
    });

    it('disables the action while a submit is in flight', () => {
        setup({ clarificationDrafts: drafts(['Type 1 diabetes']), clarificationSubmitting: true });
        expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled();
    });

    it('blocks Submit when the container reports an unusable Other selection', () => {
        setup({ clarificationDrafts: drafts(['Type 1 diabetes']), hasInvalidOtherSelection: true });
        expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
    });
});

describe('choosing answers', () => {
    it('single-select replaces the answer and clears Other', () => {
        const { onUpdateDraft } = setup({ clarificationDrafts: drafts(['Type 1 diabetes'], 'x', true) });
        fireEvent.click(screen.getByText('Type 2 diabetes'));
        expect(onUpdateDraft).toHaveBeenCalledWith('Disease', {
            selected: ['Type 2 diabetes'], text: '', otherSelected: false,
        });
    });

    it('single-select toggles the chosen row back off', () => {
        const { onUpdateDraft } = setup({ clarificationDrafts: drafts(['Type 1 diabetes']) });
        fireEvent.click(screen.getByText('Type 1 diabetes'));
        expect(onUpdateDraft).toHaveBeenCalledWith('Disease', {
            selected: [], text: '', otherSelected: false,
        });
    });

    it('multi-select accumulates instead of replacing', () => {
        const multi = { ...QUESTION, response_type: 'multi' };
        const { onUpdateDraft } = setup({
            pendingClarification: { questions: [multi] },
            clarificationDrafts: drafts(['Type 1 diabetes']),
        });
        fireEvent.click(screen.getByText('Type 2 diabetes'));
        expect(onUpdateDraft).toHaveBeenCalledWith('Disease', {
            selected: ['Type 1 diabetes', 'Type 2 diabetes'], text: '', otherSelected: false,
        });
    });

    it('uses radio semantics for single and checkbox for multi', () => {
        setup();
        expect(document.querySelector('.clarify-options')).toHaveAttribute('role', 'radiogroup');
        expect(document.querySelector('.clarify-option')).toHaveAttribute('role', 'radio');

        setup({ pendingClarification: { questions: [{ ...QUESTION, response_type: 'multi' }] } });
        const groups = document.querySelectorAll('.clarify-options');
        expect(groups[groups.length - 1]).toHaveAttribute('role', 'group');
    });

    it('is operable from the keyboard', () => {
        const { onUpdateDraft } = setup();
        const row = document.querySelector('.clarify-option');
        expect(row).toHaveAttribute('tabIndex', '0');
        fireEvent.keyDown(row, { key: 'Enter' });
        expect(onUpdateDraft).toHaveBeenCalled();
    });

    it('typing in Other records the text and ticks it', () => {
        const { onUpdateDraft } = setup();
        fireEvent.change(screen.getByPlaceholderText('Type your own answer here'),
            { target: { value: 'gestational' } });
        expect(onUpdateDraft).toHaveBeenCalledWith('Disease', {
            selected: [], text: 'gestational', otherSelected: true,
        });
    });

    it('a text-type question offers only the free-text answer', () => {
        setup({ pendingClarification: { questions: [{ ...QUESTION, response_type: 'text', options: [] }] } });
        expect(document.querySelectorAll('.clarify-option:not(.clarify-other)')).toHaveLength(0);
        expect(screen.getByPlaceholderText('Type your own answer here')).toBeInTheDocument();
    });
});

describe('the panel as a whole', () => {
    it('renders every question of a multi-question round, with one close control', () => {
        setup({
            pendingClarification: {
                questions: [QUESTION, { ...QUESTION, header: 'Population', question: 'Which population?' }],
            },
        });
        expect(document.querySelectorAll('.clarify-question')).toHaveLength(2);
        expect(screen.getAllByRole('button', { name: /skip these questions/i })).toHaveLength(1);
    });

    it('the close control skips the round', () => {
        const { onSkip } = setup();
        fireEvent.click(screen.getByRole('button', { name: /skip these questions/i }));
        expect(onSkip).toHaveBeenCalled();
    });

    it('surfaces an error from the container', () => {
        setup({ clarificationError: 'Could not identify this clarification round' });
        expect(screen.getByText(/Could not identify this clarification round/)).toBeInTheDocument();
    });

    it('renders nothing without a pending round', () => {
        const { container } = setup({ pendingClarification: null });
        expect(container).toBeEmptyDOMElement();
    });
});

/**
 * e2e/scripts/measure-clarify-panel.mjs measures a committed snapshot of this component's output,
 * because a browser is the only thing that can see heights and jsdom cannot render one. That
 * snapshot is only trustworthy while it still matches what the component renders — so this test
 * fails loudly the moment they diverge, with the command to refresh it.
 */
describe('the geometry fixture', () => {
    const FIXTURE = path.join(__dirname, '../../../e2e/fixtures/clarify-panel.html');
    const D1 = 'Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat. In id cursus mi pretium tellus duis convallis. ';
    const D2 = 'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam.';
    const D3 = 'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos.';
    const D4 = 'Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur?';

    it('still matches what the component renders', () => {
        const question = {
            header: 'Q',
            question: 'Example question lorem ipsum?',
            response_type: 'single',
            options: [
                { label: 'Answer 1', description: D1 },
                { label: 'Answer 2', description: D2 },
                { label: 'Answer 3', description: D3 },
                { label: 'Answer 4', description: D4 },
            ],
        };
        const { container } = render(
            <ClarifyPanel
                pendingClarification={{ questions: [question] }}
                clarificationDrafts={{ Q: { selected: ['Answer 1'], text: '', otherSelected: false } }}
                clarificationError=""
                clarificationSubmitting={false}
                hasInvalidOtherSelection={false}
                onUpdateDraft={() => {}}
                onSubmit={() => {}}
                onSkip={() => {}}
            />,
        );
        const fixture = fs.readFileSync(FIXTURE, 'utf8');
        if (container.innerHTML !== fixture) {
            // Say what to do, not just that it differs — jest's expect carries no message.
            throw new Error(
                "ClarifyPanel's markup changed, so e2e/scripts/measure-clarify-panel.mjs is now "
                + 'measuring a stale shape. Refresh it by writing this test\'s '
                + `container.innerHTML to ${FIXTURE}, then re-run the measurement.`,
            );
        }
        expect(container.innerHTML).toBe(fixture);
    });
});
