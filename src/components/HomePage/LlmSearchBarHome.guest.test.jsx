/** The home composer is where most visitors meet the product. Since guest mode reopened
 *  (2026-10-03) a guest may ask here — AI Chat at Standard only, 10 questions in all since
 *  2026-10-09 — and is asked to sign in when they reach past that, or for Investigate. */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

const searchOptionsChip = () => screen.getByRole('button', { name: /Search Options/i });
const optionsPanels = () => Array.from(document.querySelectorAll('.home-search-options-panel'));
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
    it('is taken to the chat with their question, on Standard', () => {
        renderBar();
        typeQuestion('What is BRCA1?');
        startChat();

        expect(mockAuth.openLoginModal).not.toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/chat/new', expect.objectContaining({
            state: expect.objectContaining({
                initialQuery: 'What is BRCA1?',
                initialSearchOptions: expect.objectContaining({ serviceTier: 'standard' }),
            }),
        }));
    });

    it('is sent on Standard even with Premium stored from a signed-in session', () => {
        mockStoredTier = 'premium';
        renderBar();
        typeQuestion('What is BRCA1?');
        startChat();
        expect(mockNavigate.mock.calls[0][1].state.initialSearchOptions.serviceTier).toBe('standard');
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
        fireEvent.click(await screen.findByRole('button', { name: 'Model: GPT-6 Luna' }));
        fireEvent.click(screen.getByRole('option', { name: /GPT-6.1 Sol/ }));
        expect(mockAuth.openLoginModal).toHaveBeenCalledWith(expect.stringMatching(/GPT-6.1 Sol is available to signed-in users/));
    });

    it('turning on Investigate asks them to sign in, and the question stays AI Chat', () => {
        renderBar();
        fireEvent.click(screen.getByTitle('Investigate off'));

        expect(mockAuth.openLoginModal).toHaveBeenCalledWith(
            "Investigate is available to signed-in users. Sign in to use it — it's free.",
        );
        expect(screen.getByTitle('Investigate off')).toBeInTheDocument();

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

    it('can turn on Investigate', () => {
        mockAuth.isAuthenticated = true;
        renderBar();
        fireEvent.click(screen.getByTitle('Investigate off'));

        expect(screen.getByTitle('Investigate on')).toBeInTheDocument();
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
