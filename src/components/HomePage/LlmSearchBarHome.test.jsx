/**
 * Search Options is withdrawn while Investigate is on, and Investigate itself only exists
 * when the deployment flag allows it.
 *
 * Deep Research runs its own hybrid retrieval and drops `filters` / `ranking_mode` entirely
 * (`service/harness_runner.py` logs a warning and discards them). A greyed-out control still
 * reads as "these settings apply, you just can't change them", so the trigger is removed and
 * the payload falls back to the defaults.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import LlmSearchBarHome from './LlmSearchBarHome';
import { trackGtagEvent } from '../../utils/gtag';

const mockNavigate = jest.fn();
// A getter rather than a value: babel compiles the component's named import down to a property
// read at each use site, so flipping this between tests is enough — no module reset needed
// (resetting the registry would hand the component a second copy of React and kill its hooks).
let mockInvestigateFlag = true;
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));
jest.mock('../../config/features', () => ({
    get INVESTIGATE_ENABLED() { return mockInvestigateFlag; },
}));
// The picker fetches its catalogue. Left real it would reach axios, fail, and settle on the
// fallback list at an arbitrary moment — so `model` would race `submit()` rather than being
// wrong in a reproducible way. Resolved synchronously here instead.
jest.mock('../../service/models', () => ({
    ...jest.requireActual('../../service/models'),
    fetchModelCatalog: () => Promise.resolve({
        models: [{
            id: 'gpt-5.6-terra',
            label: 'GPT-5.6 Terra',
            description: 'Balanced.',
            pipelines: ['chat', 'deep_research'],
        }],
        defaultModel: 'gpt-5.6-terra',
        defaultsByPipeline: { chat: 'gpt-5.6-terra', deep_research: 'gpt-5.6-terra' },
    }),
    getModelPref: () => '',
    setModelPref: jest.fn(),
}));

// MUI's useMediaQuery needs matchMedia; default to the desktop layout.
beforeAll(() => {
    window.matchMedia = window.matchMedia || ((query) => ({
        matches: false, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    }));
});

beforeEach(() => {
    mockNavigate.mockClear();
    trackGtagEvent.mockClear();
    mockInvestigateFlag = true;
});

// `setOpen` is called from an effect on mount, so it is required even though the autocomplete
// popup is irrelevant here.
const setup = (props = {}) => render(
    <LlmSearchBarHome setOpen={() => {}} autocompleteOptions={[]} {...props} />,
);

// Matched outside the drawers on purpose: the option chips inside them carry the very same
// labels once the drawer has been opened, so a plain by-role query finds several elements.
// The trigger's accessible name is the current selection, hence the alternation.
const OPTIONS_LABEL = /Search Options|Reviews only|High impact|Most recent/;
const optionsTrigger = () => {
    const drawers = Array.from(document.querySelectorAll('.MuiDrawer-root'));
    return Array.from(document.querySelectorAll('button')).find((node) => (
        !drawers.some((drawer) => drawer.contains(node)) && OPTIONS_LABEL.test(node.textContent)
    )) || null;
};
// `hidden: true` because an open drawer is a modal: MUI marks the rest of the page aria-hidden.
const investigateButton = () => screen.queryByRole('button', { name: /investigate/i, hidden: true });
// The drawers use `keepMounted`, so their content is in the DOM whether open or closed —
// presence of "Article Type" proves nothing. MUI marks a closed modal with `MuiModal-hidden`.
const drawerIsOpen = () => Array.from(document.querySelectorAll('.MuiDrawer-root'))
    .some((n) => !n.classList.contains('MuiModal-hidden'));

const chooseReviewsOnly = () => {
    fireEvent.click(optionsTrigger());
    fireEvent.click(screen.getAllByText('Reviews only')[0]);
    fireEvent.click(screen.getAllByText('Done')[0]);
};

const submit = () => {
    fireEvent.click(screen.getByRole('button', { name: /start chat/i, hidden: true }));
    return mockNavigate.mock.calls[0][1].state.initialSearchOptions;
};

describe('with Investigate off', () => {
    it('opens the drawer, showing Article Type and Sort by', () => {
        setup();
        expect(drawerIsOpen()).toBe(false);
        fireEvent.click(optionsTrigger());
        expect(drawerIsOpen()).toBe(true);
        expect(screen.getAllByText('Sort by').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Reviews only').length).toBeGreaterThan(0);
    });

    it('sends the chosen filter', () => {
        setup();
        chooseReviewsOnly();
        expect(submit()).toEqual({
            filters: ['review'],
            rankingMode: 'default',
            investigateEnabled: false,
            // Empty: these submits happen before the picker's catalogue resolves, and an
            // absent model is exactly what the chat then omits, leaving the server's default.
            model: '',
        });
    });
});

describe('with Investigate on', () => {
    it('tracks entering the mode, but not switching it back off', () => {
        setup();
        fireEvent.click(investigateButton());
        fireEvent.click(investigateButton());

        expect(trackGtagEvent).toHaveBeenCalledWith('home_investigate_enable_click', {
            source: 'home_searchbar',
        });
        expect(trackGtagEvent.mock.calls.filter(
            ([eventName]) => eventName === 'home_investigate_enable_click',
        )).toHaveLength(1);
    });

    it('tracks an Investigate question submitted from the home search box', () => {
        setup();
        const field = screen.getByPlaceholderText('Ask a question about the biomedical literature...');
        fireEvent.change(field, { target: { value: 'what is TP53?' } });
        fireEvent.click(investigateButton());
        fireEvent.keyDown(field, { key: 'Enter' });

        expect(trackGtagEvent).toHaveBeenCalledWith('investigate_question_submit', {
            source: 'home_searchbar',
            input_method: 'enter',
            queued: false,
        });
    });

    it('removes the trigger entirely', () => {
        setup();
        fireEvent.click(investigateButton());
        expect(optionsTrigger()).toBeNull();
    });

    it('closes the drawer if it was already open', async () => {
        // Not reachable by pointer today — the open drawer is a modal, so Investigate is behind
        // the backdrop. The guard exists so the panel cannot be left showing an inert drawer if
        // the toggle ever moves outside it.
        setup();
        fireEvent.click(optionsTrigger());
        expect(drawerIsOpen()).toBe(true);
        fireEvent.click(investigateButton());
        // MUI only flags the modal hidden once its exit transition finishes.
        await waitFor(() => expect(drawerIsOpen()).toBe(false));
    });

    it('sends the defaults even if a filter was chosen beforehand', () => {
        setup();
        chooseReviewsOnly();
        fireEvent.click(investigateButton());
        expect(submit()).toEqual({
            filters: [],
            rankingMode: 'default',
            investigateEnabled: true,
            // Empty: these submits happen before the picker's catalogue resolves, and an
            // absent model is exactly what the chat then omits, leaving the server's default.
            model: '',
        });
    });

    it('does not restore the old selection when switched back off', () => {
        // Turning Investigate off must not silently reinstate a filter the user last saw
        // before the control disappeared.
        setup();
        chooseReviewsOnly();
        fireEvent.click(investigateButton());
        fireEvent.click(investigateButton());
        expect(optionsTrigger()).toHaveTextContent('Search Options');
        expect(submit()).toEqual({
            filters: [],
            rankingMode: 'default',
            investigateEnabled: false,
            // Empty: these submits happen before the picker's catalogue resolves, and an
            // absent model is exactly what the chat then omits, leaving the server's default.
            model: '',
        });
    });
});

describe('with INVESTIGATE_ENABLED off', () => {
    it('drops the Investigate toggle and leaves Search Options live', () => {
        mockInvestigateFlag = false;
        setup();
        expect(investigateButton()).toBeNull();
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

    it('stays usable and says the other answer is not being interrupted', () => {
        setup({ isAgentRunActive: true });
        expect(screen.getByPlaceholderText(PLACEHOLDER)).not.toBeDisabled();
        expect(investigateButton()).not.toBeDisabled();
    });

    it('starts the new conversation on Enter', () => {
        setup({ isAgentRunActive: true });
        const field = screen.getByPlaceholderText(PLACEHOLDER);
        fireEvent.change(field, { target: { value: 'what is TP53?' } });
        fireEvent.keyDown(field, { key: 'Enter' });
        expect(mockNavigate).toHaveBeenCalledWith('/chat', expect.objectContaining({
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
        expect(mockNavigate).toHaveBeenCalledWith('/chat', expect.objectContaining({
            state: expect.objectContaining({ initialQuery: 'what is BRCA1?' }),
        }));
    });
});

describe('when the quota is gone', () => {
    // A different matter entirely: there is no run to start, so the box really is locked.
    it('locks every entry point and does not navigate', () => {
        setup({ isQueryLimitReached: true });

        const field = document.querySelector('textarea:not([aria-hidden="true"])');
        expect(field).toBeDisabled();
        expect(investigateButton()).toBeDisabled();

        const start = screen.getByRole('button', { name: /start chat/i, hidden: true });
        expect(start).toHaveAttribute('aria-disabled', 'true');
        fireEvent.click(start);
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});
