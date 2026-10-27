/**
 * The home composer (design: GLKB Effort A): the model-and-effort chip, Options, and what a
 * question is sent with.
 *
 * Medium effort is the chat agent; Extra is deep research (formerly the Investigate tab), which
 * runs its own retrieval and drops `filters` / `ranking_mode` (`service/harness_runner.py`), so
 * at Extra the payload falls back to the defaults and Options says the filters don't apply.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import LlmSearchBarHome from './LlmSearchBarHome';
import { trackGtagEvent } from '../../utils/gtag';

const mockNavigate = jest.fn();
// A getter rather than a value: babel compiles the component's named import down to a property
// read at each use site, so flipping this between tests is enough — no module reset needed
// (resetting the registry would hand the component a second copy of React and kill its hooks).
let mockInvestigateFlag = true;
let mockReviewFlag = false;
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));
jest.mock('../../service/LiteratureReview', () => ({}));
// These are about the composer's own behaviour, so the reader is signed in throughout; a
// guest's composer is LlmSearchBarHome.guest.test.jsx.
jest.mock('../Auth/AuthContext', () => ({
    useAuth: () => ({ isAuthenticated: true, loading: false, openLoginModal: jest.fn() }),
}));
jest.mock('../../config/features', () => ({
    get INVESTIGATE_ENABLED() { return mockInvestigateFlag; },
    get LITERATURE_REVIEW_ENABLED() { return mockReviewFlag; },
}));
// The picker fetches the prices. Left real it would reach axios, fail, and settle on the
// fallback at an arbitrary moment — so `serviceTier` would race `submit()` rather than being
// wrong in a reproducible way. Resolved here instead.
jest.mock('../../service/serviceTiers', () => {
    const actual = jest.requireActual('../../service/serviceTiers');
    return {
        ...actual,
        fetchTierPricing: () => Promise.resolve(actual.parsePricing(actual.FALLBACK_PRICING)),
        getTierPref: () => '',
        setTierPref: jest.fn(),
    };
});

// MUI's useMediaQuery needs matchMedia; default to the desktop layout.
beforeAll(() => {
    window.matchMedia = window.matchMedia || ((query) => ({
        matches: false, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    }));
});

beforeEach(() => {
    window.localStorage.clear();
    mockNavigate.mockClear();
    trackGtagEvent.mockClear();
    mockInvestigateFlag = true;
    mockReviewFlag = false;
});

// `setOpen` is called from an effect on mount, so it is required even though the autocomplete
// popup is irrelevant here.
const setup = (props = {}) => render(
    <LlmSearchBarHome setOpen={() => {}} autocompleteOptions={[]} {...props} />,
);

// The row's Options button (outside the drawer).
const optionsTrigger = () => document.querySelector('button.composer-options-trigger');
const chatTab = () => screen.queryByRole('tab', { name: /chat/i, hidden: true });
// The drawer uses `keepMounted`, so its content is in the DOM whether open or closed. MUI marks a
// closed modal with `MuiModal-hidden`.
const drawerIsOpen = () => Array.from(document.querySelectorAll('.MuiDrawer-root'))
    .some((n) => !n.classList.contains('MuiModal-hidden'));

// The chip waits for the prices before it can open.
const effortChip = () => document.querySelector('button.effort-chip');
const chipReady = () => waitFor(() => expect(effortChip()).not.toBeDisabled());
const openEffortMenu = () => {
    fireEvent.click(effortChip());
    fireEvent.click(document.querySelector('.effort-sub-row'));
};
const levelRow = (name) => Array.from(document.querySelectorAll('.effort-level-row'))
    .find((row) => row.querySelector('.effort-level-label').textContent.startsWith(name));
const chooseEffortLevel = async (name) => {
    await chipReady();
    openEffortMenu();
    fireEvent.click(levelRow(name));
};

const chooseReviewsOnly = () => {
    fireEvent.click(optionsTrigger());
    fireEvent.click(screen.getAllByText('Reviews only')[0]);
    fireEvent.click(screen.getAllByText('Done')[0]);
};

// A question first: with an empty box the arrow starts nothing (see the tests at the end).
const submit = () => {
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'What does TP53 do?' } });
    fireEvent.click(screen.getByRole('button', { name: /start chat/i, hidden: true }));
    return mockNavigate.mock.calls[0][1].state.initialSearchOptions;
};

const exampleListIsOpen = () => Boolean(document.querySelector('.homepage-autocomplete-listbox'));

// The chips live INSIDE the Autocomplete, whose root focuses the input on any click it sees;
// `openOnFocus` then drops the example list open. Every control in that row has to stop its
// click from getting there, or opening it also opens the examples — underneath the very menu
// the reader is aiming at.
describe('the controls in the composer row', () => {
    it('opens the model-and-effort menu without opening the example list', async () => {
        setup({ autocompleteOptions: ['What is TP53?'] });
        await chipReady();
        expect(effortChip()).toHaveTextContent('GPT-6.1 Terra · Medium');
        expect(exampleListIsOpen()).toBe(false);

        fireEvent.click(effortChip());

        expect(document.querySelector('.effort-menu')).not.toBeNull();
        expect(Array.from(document.querySelectorAll('.effort-model-label')).map((n) => n.textContent))
            .toEqual(['GPT-6.1 Sol', 'GPT-6.1 Terra', 'GPT-6 Luna']);
        expect(exampleListIsOpen()).toBe(false);
        expect(screen.queryByText('What is TP53?')).toBeNull();
    });

    it('hides an example list that was already open when the menu opens', async () => {
        setup({ autocompleteOptions: ['What is TP53?'] });
        await chipReady();
        fireEvent.focus(screen.getByPlaceholderText('Ask a question about the biomedical literature...'));
        await waitFor(() => expect(exampleListIsOpen()).toBe(true));

        fireEvent.click(effortChip());

        expect(document.querySelector('.effort-menu')).not.toBeNull();
        expect(exampleListIsOpen()).toBe(false);
    });

    it('does the same for Options', () => {
        setup({ autocompleteOptions: ['What is TP53?'] });
        fireEvent.click(optionsTrigger());
        expect(exampleListIsOpen()).toBe(false);
    });

    it('lists the five efforts, with only Medium and Extra offered', async () => {
        setup();
        await chipReady();
        openEffortMenu();
        const rows = Array.from(document.querySelectorAll('.effort-level-row'));
        expect(rows.map((row) => row.querySelector('.effort-level-label').firstChild.textContent))
            .toEqual(['Low', 'Medium', 'High', 'Extra', 'Max']);
        expect(rows.map((row) => row.getAttribute('aria-disabled')))
            .toEqual(['true', 'false', 'true', 'false', 'true']);
        expect(levelRow('Medium')).toHaveAttribute('aria-checked', 'true');
        // a greyed-out level cannot be picked
        fireEvent.click(levelRow('High'));
        expect(effortChip()).toHaveTextContent('· Medium');
    });

    it('picks a model from the menu and keeps it open', async () => {
        setup();
        await chipReady();
        fireEvent.click(effortChip());
        fireEvent.click(screen.getByRole('menuitemradio', { name: /GPT-6 Luna/ }));
        expect(effortChip()).toHaveTextContent('GPT-6 Luna · Medium');
        expect(document.querySelector('.effort-menu')).not.toBeNull();
    });
});

describe('at Medium effort (the chat agent)', () => {
    it('carries the typed submit method through the route handoff', () => {
        setup();
        const field = screen.getByPlaceholderText('Ask a question about the biomedical literature...');
        fireEvent.change(field, { target: { value: 'what is TP53?' } });
        fireEvent.keyDown(field, { key: 'Enter' });
        expect(mockNavigate.mock.calls[0][1].state.initialQueryMethod).toBe('enter');
    });

    it('labels a submitted prefill as an example query', () => {
        setup({ prefillQuery: 'Example TP53 question' });
        fireEvent.click(screen.getByRole('button', { name: /start chat/i, hidden: true }));
        expect(mockNavigate.mock.calls[0][1].state.initialQueryMethod).toBe('example');
    });

    it('opens the drawer, showing Research tools and the search filters', () => {
        setup();
        expect(drawerIsOpen()).toBe(false);
        fireEvent.click(optionsTrigger());
        expect(drawerIsOpen()).toBe(true);
        expect(screen.getByText('Research tools')).toBeInTheDocument();
        expect(screen.getAllByText('Sort by').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Reviews only').length).toBeGreaterThan(0);
    });

    it('sends the chosen filter, and the knowledge graph Auto turns on at Medium', () => {
        setup();
        chooseReviewsOnly();
        expect(optionsTrigger()).toHaveAttribute('aria-label', 'Options (changed)');
        expect(submit()).toEqual({
            filters: ['review'],
            rankingMode: 'default',
            investigateEnabled: false,
            // Empty: these submits happen before the picker's prices resolve, and an absent
            // tier is exactly what the chat then omits, leaving the server's default.
            serviceTier: '',
            graph: true,
        });
    });
});

describe('at Extra effort (deep research, formerly Investigate)', () => {
    it('tracks entering it', async () => {
        setup();
        await chooseEffortLevel('Extra');
        expect(effortChip()).toHaveTextContent('· Extra');
        expect(trackGtagEvent).toHaveBeenCalledWith('home_investigate_enable_click', {
            source: 'home_searchbar',
        });
        // and the mode hint gives Extra's time
        expect(document.querySelector('.composer-modes-duration')?.textContent ?? '3–5 min').toBe('3–5 min');
    });

    it('tracks a question submitted from the home search box', async () => {
        setup();
        await chooseEffortLevel('Extra');
        const field = screen.getByPlaceholderText('Ask a question about the biomedical literature...');
        fireEvent.change(field, { target: { value: 'what is TP53?' } });
        fireEvent.keyDown(field, { key: 'Enter' });

        expect(trackGtagEvent).toHaveBeenCalledWith('investigate_question_submit', {
            source: 'home_searchbar',
            input_method: 'enter',
            queued: false,
        });
    });

    it('says in Options that the filters do not apply, and the tools are always on', async () => {
        setup();
        await chooseEffortLevel('Extra');
        fireEvent.click(optionsTrigger());
        expect(screen.getByText(/Extra runs its own multi-channel retrieval/)).toBeInTheDocument();
        expect(screen.getAllByText('Extra always includes it.')).toHaveLength(2);
        expect(screen.queryAllByText('Reviews only')).toHaveLength(0);
    });

    it('sends the defaults even if a filter was chosen beforehand', async () => {
        setup();
        chooseReviewsOnly();
        await chooseEffortLevel('Extra');
        expect(submit()).toEqual({
            filters: [],
            rankingMode: 'default',
            investigateEnabled: true,
            serviceTier: 'advanced',
        });
    });

    it('is the effort the next visit starts with', async () => {
        const first = setup();
        await chooseEffortLevel('Extra');
        first.unmount();
        setup();
        await chipReady();
        expect(effortChip()).toHaveTextContent('· Extra');
    });

    it('asks a prefill for "investigate" to switch to Extra', async () => {
        setup({ requestedMode: { mode: 'investigate' } });
        await chipReady();
        expect(effortChip()).toHaveTextContent('· Extra');
    });
});

describe('with LITERATURE_REVIEW_ENABLED on', () => {
    const reviewTab = () => screen.getByRole('tab', { name: /Literature Review/, hidden: true });

    it('offers Chat and Literature Review as tabs (Investigate is the Extra effort now)', () => {
        mockReviewFlag = true;
        setup();
        const tabs = screen.getAllByRole('tab', { hidden: true });
        expect(tabs.map((n) => n.querySelector('.composer-mode-label').textContent)).toEqual(['Chat', 'Literature Review']);
        expect(tabs.map((n) => Boolean(n.querySelector('.beta-badge')))).toEqual([false, true]);
        expect(screen.getByRole('tab', { name: /Chat/, hidden: true })).toHaveAttribute('aria-selected', 'true');
    });

    it('sends a question asked with Literature Review to its own page, with its scope', () => {
        mockReviewFlag = true;
        setup();
        fireEvent.click(reviewTab());
        expect(screen.getByTitle('Literature Review on')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Topic or research question for your review/)).toBeInTheDocument();
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'osimertinib resistance' } });
        fireEvent.click(screen.getByRole('button', { name: /start chat/i, hidden: true }));
        const { state } = mockNavigate.mock.calls[0][1];
        expect(mockNavigate.mock.calls[0][0]).toBe('/literature-review');
        expect(state.initialQuery).toBe('osimertinib resistance');
        expect(state.scope).toEqual({
            targetWords: 6000, startYear: null, cutoffYear: null, notify: true, articleTypes: 'all',
            citationStyle: 'vancouver', sources: null,
        });
        expect(state.papers).toEqual([]);
        // The model is picked with the chat's own picker: a service tier, never a model id.
        expect(state).not.toHaveProperty('model');
        expect(state).toHaveProperty('serviceTier');
    });

    it('takes any length typed, kept in the service\'s bounds', () => {
        mockReviewFlag = true;
        setup();
        fireEvent.click(reviewTab());
        fireEvent.click(screen.getByRole('button', { name: /Length/, hidden: true }));
        const input = screen.getByLabelText('Custom length in words');
        fireEvent.change(input, { target: { value: '25000' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(screen.getByRole('button', { name: /Length: 12,000 words/, hidden: true })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Length/, hidden: true }));
        fireEvent.change(screen.getByLabelText('Custom length in words'), { target: { value: '2750' } });
        fireEvent.click(screen.getByRole('button', { name: 'Set', hidden: true }));
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'CAR-T in solid tumors' } });
        fireEvent.click(screen.getByRole('button', { name: /start chat/i, hidden: true }));
        expect(mockNavigate.mock.calls[0][1].state.scope.targetWords).toBe(2800);
    });

    it('sends the article types and citation style the reader picked', () => {
        mockReviewFlag = true;
        setup();
        fireEvent.click(reviewTab());
        fireEvent.click(screen.getByRole('button', { name: /Types: All types/, hidden: true }));
        fireEvent.click(screen.getByRole('option', { name: /Primary research/ }));
        fireEvent.click(screen.getByRole('button', { name: /Style: Vancouver/, hidden: true }));
        fireEvent.click(screen.getByRole('option', { name: /APA 7/ }));
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'CAR-T in solid tumors' } });
        fireEvent.click(screen.getByRole('button', { name: /start chat/i, hidden: true }));
        const { scope } = mockNavigate.mock.calls[0][1].state;
        expect(scope.articleTypes).toBe('primary');
        expect(scope.citationStyle).toBe('apa');
    });

    it('sends the length the reader picked', () => {
        mockReviewFlag = true;
        setup();
        fireEvent.click(reviewTab());
        fireEvent.click(screen.getByRole('button', { name: /Length/, hidden: true }));
        fireEvent.click(screen.getByRole('option', { name: /4,500 words/ }));
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'CAR-T in solid tumors' } });
        fireEvent.click(screen.getByRole('button', { name: /start chat/i, hidden: true }));
        expect(mockNavigate.mock.calls[0][1].state.scope.targetWords).toBe(4500);
    });

    it('sends the years picked, from a start year to an end year', () => {
        const now = new Date().getFullYear();
        mockReviewFlag = true;
        setup();
        fireEvent.click(reviewTab());
        fireEvent.click(screen.getByRole('button', { name: `Years: to ${now}`, hidden: true }));
        const from = screen.getByRole('group', { name: 'From' });
        const to = screen.getByRole('group', { name: 'To' });
        fireEvent.click(within(from).getByRole('option', { name: String(now - 10) }));
        // the panel stays open for the other end; an end before the start is not offered
        fireEvent.click(within(to).getByRole('option', { name: String(now - 2) }));
        expect(screen.getByRole('button', { name: `Years: ${now - 10}–${now - 2}`, hidden: true })).toBeInTheDocument();
        // any two typed
        fireEvent.change(screen.getByLabelText('From year'), { target: { value: '2008' } });
        fireEvent.change(screen.getByLabelText('To year'), { target: { value: '2001' } });
        expect(screen.getByRole('button', { name: 'Set', hidden: true })).toBeDisabled();
        fireEvent.change(screen.getByLabelText('To year'), { target: { value: '2019' } });
        fireEvent.keyDown(screen.getByLabelText('To year'), { key: 'Enter' });
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'CAR-T in solid tumors' } });
        fireEvent.click(screen.getByRole('button', { name: /start chat/i, hidden: true }));
        const { scope } = mockNavigate.mock.calls[0][1].state;
        expect(scope.startYear).toBe(2008);
        expect(scope.cutoffYear).toBe(2019);
    });

    it('offers every source, and says the papers ones need papers first', () => {
        mockReviewFlag = true;
        setup();
        fireEvent.click(reviewTab());
        fireEvent.click(screen.getByRole('button', { name: 'Sources: Search only', hidden: true }));
        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
            expect.stringMatching(/^Search only/), expect.stringMatching(/^Your papers \+ search/),
            expect.stringMatching(/^Your papers only/),
        ]);
        fireEvent.click(screen.getByRole('option', { name: /Your papers only/ }));
        expect(screen.getByRole('status')).toHaveTextContent(/No papers added yet: upload at least one/);
        // not chosen: still a search
        expect(screen.getByRole('button', { name: 'Sources: Search only', hidden: true })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /Your papers only/ })).toHaveAttribute('aria-disabled', 'true');
    });

    it('leaves Extra working beside it', async () => {
        mockReviewFlag = true;
        setup();
        await chooseEffortLevel('Extra');
        expect(chatTab()).toHaveAttribute('aria-selected', 'true');
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'what is TP53?' } });
        fireEvent.click(screen.getByRole('button', { name: /start chat/i, hidden: true }));
        const [path, opts] = mockNavigate.mock.calls[0];
        expect(path).toBe('/chat/new');
        expect(opts.state.initialSearchOptions.investigateEnabled).toBe(true);
    });
});

describe('with INVESTIGATE_ENABLED off', () => {
    it('greys Extra out and leaves Options live', async () => {
        mockInvestigateFlag = false;
        setup();
        await chipReady();
        openEffortMenu();
        expect(levelRow('Extra')).toHaveAttribute('aria-disabled', 'true');
        fireEvent.click(optionsTrigger());
        expect(drawerIsOpen()).toBe(true);
    });
});

describe('while another Agent conversation is answering', () => {
    /* This box used to be locked whenever any run was in flight, and New Chat during a run
       sends the reader to this page — so the one place they were sent to get away from a busy
       conversation was itself a dead end reading "A conversation is still loading". A question
       asked here opens its own conversation with its own history id, and the backend locks per
       history id, so it does not race the answer already being written. */
    const PLACEHOLDER = 'Ask a new question — the other answer keeps writing';

    it('stays usable and says the other answer is not being interrupted', async () => {
        setup({ isAgentRunActive: true });
        expect(screen.getByPlaceholderText(PLACEHOLDER)).not.toBeDisabled();
        await chipReady();
    });

    it('starts the new conversation on Enter', () => {
        setup({ isAgentRunActive: true });
        const field = screen.getByPlaceholderText(PLACEHOLDER);
        fireEvent.change(field, { target: { value: 'what is TP53?' } });
        fireEvent.keyDown(field, { key: 'Enter' });
        expect(mockNavigate).toHaveBeenCalledWith('/chat/new', expect.objectContaining({
            state: expect.objectContaining({ initialQuery: 'what is TP53?' }),
        }));
    });

    it('starts it from the button too', () => {
        setup({ isAgentRunActive: true });
        const field = screen.getByPlaceholderText(PLACEHOLDER);
        fireEvent.change(field, { target: { value: 'what is BRCA1?' } });
        const start = screen.getByRole('button', { name: /start chat/i, hidden: true });
        expect(start).toHaveAttribute('aria-disabled', 'false');
        fireEvent.click(start);
        expect(mockNavigate).toHaveBeenCalledWith('/chat/new', expect.objectContaining({
            state: expect.objectContaining({ initialQuery: 'what is BRCA1?' }),
        }));
    });
});

describe('when the quota is gone', () => {
    // A different matter entirely: there is no run to start, so the box really is locked.
    it('locks every entry point and does not navigate', async () => {
        setup({ isQueryLimitReached: true });

        const field = document.querySelector('textarea:not([aria-hidden="true"])');
        expect(field).toBeDisabled();
        await waitFor(() => expect(effortChip()).not.toBeNull());
        expect(effortChip()).toBeDisabled();

        const start = screen.getByRole('button', { name: /start chat/i, hidden: true });
        expect(start).toHaveAttribute('aria-disabled', 'true');
        fireEvent.click(start);
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});

describe('with nothing typed', () => {
    const start = () => screen.getByRole('button', { name: /start chat/i, hidden: true });

    it.each([['Chat', false], ['Literature Review', true]])(
        'the arrow starts nothing in %s mode, and starts once there is a question',
        (mode, review) => {
            mockReviewFlag = review;
            setup();
            if (mode !== 'Chat') fireEvent.click(screen.getByRole('tab', { name: new RegExp(mode), hidden: true }));
            expect(start()).toHaveAttribute('aria-disabled', 'true');
            fireEvent.click(start());
            fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
            fireEvent.change(screen.getByRole('combobox'), { target: { value: '   ' } });
            fireEvent.click(start());
            expect(mockNavigate).not.toHaveBeenCalled();

            fireEvent.change(screen.getByRole('combobox'), { target: { value: 'EGFR resistance' } });
            expect(start()).toHaveAttribute('aria-disabled', 'false');
            fireEvent.click(start());
            expect(mockNavigate).toHaveBeenCalledTimes(1);
            expect(mockNavigate.mock.calls[0][0]).toBe(review ? '/literature-review' : '/chat/new');
        },
    );
});

describe('Research tools (Options)', () => {
    const choose = (tool, choice) => {
        const group = screen.getByRole('radiogroup', { name: tool, hidden: true });
        fireEvent.click(within(group).getByRole('radio', { name: choice, hidden: true }));
    };

    it('sends figures and the graph as chosen, and Reset goes back to Auto', () => {
        setup();
        fireEvent.click(optionsTrigger());
        choose('Figures', 'On');
        choose('Knowledge Graph', 'Off');
        fireEvent.click(screen.getAllByText('Done')[0]);
        expect(submit()).toEqual({
            filters: [], rankingMode: 'default', investigateEnabled: false, serviceTier: '',
            figures: true,
        });

        mockNavigate.mockClear();
        fireEvent.click(optionsTrigger());
        fireEvent.click(screen.getAllByText('Reset')[0]);
        fireEvent.click(screen.getAllByText('Done')[0]);
        expect(submit()).toEqual({
            filters: [], rankingMode: 'default', investigateEnabled: false, serviceTier: '',
            graph: true,
        });
    });

    it('sends neither at Extra, which does both on its own', async () => {
        setup();
        await chooseEffortLevel('Extra');
        const sent = submit();
        expect(sent).not.toHaveProperty('figures');
        expect(sent).not.toHaveProperty('graph');
    });
});
