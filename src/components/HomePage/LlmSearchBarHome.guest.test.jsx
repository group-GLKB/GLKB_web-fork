/** The home composer is where most visitors meet the product. Since guest mode reopened
 *  (2026-10-03) a guest may ask here — Chat at Medium effort on GPT-6.1 Terra or GPT-6 Luna —
 *  and is asked to sign in when they reach past that: GPT-6.1 Sol, or Extra effort. */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import LlmSearchBar from './LlmSearchBarHome';

const mockAuth = { isAuthenticated: false, loading: false, openLoginModal: jest.fn() };
const mockNavigate = jest.fn();

jest.mock('../Auth/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));
let mockStoredTier = '';
jest.mock('../../service/serviceTiers', () => {
    const actual = jest.requireActual('../../service/serviceTiers');
    return {
        ...actual,
        fetchTierPricing: () => Promise.resolve(actual.parsePricing(actual.FALLBACK_PRICING)),
        getTierPref: () => mockStoredTier,
        setTierPref: jest.fn(),
    };
});

beforeAll(() => {
    window.matchMedia = window.matchMedia || ((query) => ({
        matches: false, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    }));
});

beforeEach(() => {
    window.localStorage.clear();
    mockAuth.openLoginModal = jest.fn();
    mockAuth.isAuthenticated = false;
    mockAuth.loading = false;
    mockNavigate.mockClear();
    mockStoredTier = '';
});

/* The home page owns the example list and the "a run is going" flag; the bar only reports
   into them. Stubbed so these tests are about the gate. */
const renderBar = (props = {}) => render(
    <LlmSearchBar
        setOpen={() => {}}
        setExamplesOpen={() => {}}
        onCollapseExampleLists={() => {}}
        autocompleteOptions={[]}
        {...props}
    />,
);

const searchOptionsChip = () => document.querySelector('button.composer-options-trigger');
const optionsPanels = () => Array.from(document.querySelectorAll('.composer-options-drawer'));
const effortChip = () => document.querySelector('button.effort-chip');
const openMenu = async () => {
    await waitFor(() => expect(effortChip()).not.toBeDisabled());
    fireEvent.click(effortChip());
};
const pickExtra = async () => {
    await openMenu();
    fireEvent.click(document.querySelector('.effort-sub-row'));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Extra/ }));
};
/* The drawers stay mounted when closed, so "did it open" is a question about visibility
   rather than about the DOM containing the panel. */
const isVisible = (node) => {
    for (let el = node; el; el = el.parentElement) {
        const style = window.getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
    }
    return true;
};

const startChat = () => {
    const button = screen.getByRole('button', { name: 'Start chat' });
    fireEvent.mouseDown(button);
    fireEvent.click(button);
};

const typeQuestion = (text) => {
    const box = screen.getByPlaceholderText(/Ask a question about the biomedical literature/i);
    fireEvent.change(box, { target: { value: text } });
    return box;
};

describe('a guest at the home composer', () => {
    it('is taken to the chat with their question, on the guest tier (GPT-6.1 Terra)', () => {
        renderBar();
        typeQuestion('What is BRCA1?');
        startChat();

        expect(mockAuth.openLoginModal).not.toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/chat/new', expect.objectContaining({
            state: expect.objectContaining({
                initialQuery: 'What is BRCA1?',
                initialSearchOptions: expect.objectContaining({ serviceTier: 'advanced' }),
            }),
        }));
    });

    it('is sent on the guest tier even with Premium stored from a signed-in session', () => {
        mockStoredTier = 'premium';
        renderBar();
        typeQuestion('What is BRCA1?');
        startChat();
        expect(mockNavigate.mock.calls[0][1].state.initialSearchOptions.serviceTier).toBe('advanced');
    });

    it('can open the search options', () => {
        renderBar();
        fireEvent.mouseDown(searchOptionsChip());
        fireEvent.click(searchOptionsChip());
        expect(optionsPanels().some((panel) => isVisible(panel))).toBe(true);
    });

    it('is asked to sign in, with the reason, once the free questions are used — question kept', () => {
        renderBar({ isQueryLimitReached: true, limitReachedText: "You've used your 10 free questions." });
        const box = typeQuestion('What is BRCA1?');
        expect(box).toBeEnabled();
        startChat();

        expect(mockAuth.openLoginModal).toHaveBeenCalledWith("You've used your 10 free questions.");
        expect(mockNavigate).not.toHaveBeenCalled();
        expect(box).toHaveValue('What is BRCA1?');
    });

    it('picking GPT-6.1 Sol asks them to sign in', async () => {
        renderBar();
        await openMenu();
        expect(screen.getByRole('menuitemradio', { name: /GPT-6.1 Sol/ })).toHaveTextContent('Sign in');
        fireEvent.click(screen.getByRole('menuitemradio', { name: /GPT-6.1 Sol/ }));
        expect(mockAuth.openLoginModal).toHaveBeenCalledWith(expect.stringMatching(/GPT-6.1 Sol is available to signed-in users/));
    });

    it('may pick GPT-6 Luna, and the question is sent on Standard', async () => {
        renderBar();
        await openMenu();
        fireEvent.click(screen.getByRole('menuitemradio', { name: /GPT-6 Luna/ }));
        expect(mockAuth.openLoginModal).not.toHaveBeenCalled();
        expect(effortChip()).toHaveTextContent('GPT-6 Luna · Medium');
        typeQuestion('What is BRCA1?');
        startChat();
        expect(mockNavigate.mock.calls[0][1].state.initialSearchOptions.serviceTier).toBe('standard');
    });

    it('picking Extra effort asks them to sign in, and the question stays at Medium', async () => {
        renderBar();
        await pickExtra();

        expect(mockAuth.openLoginModal).toHaveBeenCalledWith(
            "Extra effort is available to signed-in users. Sign in to use it — it's free.",
        );
        expect(effortChip()).toHaveTextContent('· Medium');

        mockAuth.openLoginModal.mockClear();
        typeQuestion('What is BRCA1?');
        startChat();
        expect(mockNavigate).toHaveBeenCalledWith('/chat/new', expect.objectContaining({
            state: expect.objectContaining({
                initialSearchOptions: expect.objectContaining({ investigateEnabled: false }),
            }),
        }));
    });
});

describe('a signed-in reader at the same composer', () => {
    it('is taken to the chat with their question', () => {
        mockAuth.isAuthenticated = true;
        renderBar();
        const box = screen.getByPlaceholderText(/Ask a question about the biomedical literature/i);

        fireEvent.change(box, { target: { value: 'What is BRCA1?' } });
        startChat();

        expect(mockNavigate).toHaveBeenCalledWith('/chat/new', expect.objectContaining({
            state: expect.objectContaining({ initialQuery: 'What is BRCA1?' }),
        }));
        expect(mockAuth.openLoginModal).not.toHaveBeenCalled();
    });

    it('can pick Extra effort', async () => {
        mockAuth.isAuthenticated = true;
        renderBar();
        await pickExtra();

        expect(effortChip()).toHaveTextContent('· Extra');
        expect(mockAuth.openLoginModal).not.toHaveBeenCalled();
    });

    it('can still open the search options', () => {
        mockAuth.isAuthenticated = true;
        renderBar();

        fireEvent.mouseDown(searchOptionsChip());
        fireEvent.click(searchOptionsChip());

        expect(optionsPanels().some((panel) => isVisible(panel))).toBe(true);
    });
});
