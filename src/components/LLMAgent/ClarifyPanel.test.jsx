/**
 * Clarify panel behaviour — Figma "Asking User Question v2" (node 581:7642).
 *
 * The properties worth pinning are the ones a redesign can quietly break:
 *   * the footer is one action, reading Skip until something is answered and Submit after (the
 *     design's own state frames), and each still reaches its handler;
 *   * single-select replaces, multi-select accumulates, and the marker says which is which;
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
        // The number lives in the row's marker, which is where the design puts it.
        expect(within(rows[0]).getByText('1')).toHaveClass('clarify-option-marknum');
        expect(within(rows[0]).getByText('Type 1 diabetes')).toBeInTheDocument();
        expect(within(rows[0]).getByText(/Autoimmune beta-cell destruction/)).toBeInTheDocument();
        expect(within(rows[1]).getByText('2')).toHaveClass('clarify-option-marknum');
        // ...and Other carries the number after them.
        expect(within(document.querySelector('.clarify-other')).getByText('3'))
            .toHaveClass('clarify-option-marknum');
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

// One action, swapping between Skip and Submit. Declining a round the run is blocked on stays
// available whatever is answered — through the header's ✕, which is where the design puts it.
describe('the footer', () => {
    it('is Skip while nothing is answered, and skips the round', () => {
        const { onSkip } = setup();
        expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
        expect(onSkip).toHaveBeenCalled();
    });

    it('becomes Submit once something is answered', () => {
        setup({ clarificationDrafts: drafts(['Type 1 diabetes']) });
        expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    });

    it('submits from the last question', () => {
        const { onSubmit } = setup({ clarificationDrafts: drafts(['Type 2 diabetes']) });
        fireEvent.click(screen.getByRole('button', { name: /submit/i }));
        expect(onSubmit).toHaveBeenCalled();
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

// A round can carry up to four questions. Stacked in one column the later ones were buried and
// there was no sense of how many were left; the design's own title carries "(1/3)".
describe('stepping through a multi-question round', () => {
    const q2 = { ...QUESTION, header: 'Aspect', question: 'Which aspects?', response_type: 'multi' };
    const two = { pendingClarification: { questions: [QUESTION, q2] } };
    const title = () => document.querySelector('.clarify-question-text').textContent;

    it('shows one question at a time, with its position in the title', () => {
        setup(two);
        expect(title()).toBe('Which disease should the review focus on? (1/2)');
        expect(screen.queryByText('Which aspects?')).not.toBeInTheDocument();
    });

    it('the action advances until the last question, then submits', () => {
        setup({ ...two, clarificationDrafts: drafts(['Type 1 diabetes']) });
        expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /next/i }));

        expect(title()).toBe('Which aspects? (2/2)');
        // Answered on question 1, so the round has something to submit even though this one is blank.
        expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
    });

    it('Skip on an unanswered question steps past it rather than declining the round', () => {
        const { onSkip } = setup(two);
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
        expect(onSkip).not.toHaveBeenCalled();
        expect(title()).toBe('Which aspects? (2/2)');
    });

    it('Back returns to the previous question, and is absent on the first', () => {
        setup(two);
        expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
        fireEvent.click(screen.getByRole('button', { name: /back/i }));
        expect(title()).toBe('Which disease should the review focus on? (1/2)');
    });

    it('advancing is allowed with nothing chosen — a blank answer takes the default', () => {
        setup(two);
        expect(screen.getByRole('button', { name: 'Skip' })).not.toBeDisabled();
    });

    it('a single question shows no counter and no Next', () => {
        setup({ clarificationDrafts: drafts(['Type 1 diabetes']) });
        expect(title()).toBe('Which disease should the review focus on?');
        expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    });
});

// The marker is the only thing that says whether a second click adds to a choice or replaces it,
// so it is worth pinning that the two modes do not render the same.
describe('telling single from multi apart', () => {
    it('pick-one numbers every marker, Other included', () => {
        setup();
        expect(document.querySelectorAll('.clarify-option-marknum')).toHaveLength(3);
    });

    it('pick-any leaves them empty', () => {
        setup({ pendingClarification: { questions: [{ ...QUESTION, response_type: 'multi' }] } });
        expect(document.querySelectorAll('.clarify-option-mark')).toHaveLength(3);
        expect(document.querySelectorAll('.clarify-option-marknum')).toHaveLength(0);
    });

    it('a chosen row is marked selected in either mode', () => {
        setup({ clarificationDrafts: drafts(['Type 1 diabetes']) });
        const rows = document.querySelectorAll('.clarify-option:not(.clarify-other)');
        expect(rows[0].querySelector('.clarify-option-mark')).toHaveClass('selected');
        expect(rows[0].querySelector('.clarify-option-marknum')).not.toBeInTheDocument();
        expect(rows[1].querySelector('.clarify-option-mark')).not.toHaveClass('selected');
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
    it('shows one question, with one close control', () => {
        setup({
            pendingClarification: {
                questions: [QUESTION, { ...QUESTION, header: 'Population', question: 'Which population?' }],
            },
        });
        expect(document.querySelectorAll('.clarify-question')).toHaveLength(1);
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
        if (process.env.UPDATE_FIXTURES) {
            fs.writeFileSync(FIXTURE, container.innerHTML);
        }
        const fixture = fs.readFileSync(FIXTURE, 'utf8');
        if (container.innerHTML !== fixture) {
            // Say what to do, not just that it differs — jest's expect carries no message.
            throw new Error(
                "ClarifyPanel's markup changed, so e2e/scripts/measure-clarify-panel.mjs is now "
                + `measuring a stale shape. Refresh ${FIXTURE} by re-running this test with `
                + 'UPDATE_FIXTURES=1, then re-run the measurement.',
            );
        }
        expect(container.innerHTML).toBe(fixture);
    });
});
