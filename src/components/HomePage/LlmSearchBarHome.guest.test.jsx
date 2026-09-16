/** The home composer is where most visitors meet the product — and where a guest's question
 *  used to go all the way to a server that refuses it. */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import LlmSearchBar from './LlmSearchBarHome';

const mockAuth = { isAuthenticated: false, loading: false, openLoginModal: jest.fn() };
const mockNavigate = jest.fn();

jest.mock('../Auth/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));
jest.mock('../../service/models', () => ({
    ...jest.requireActual('../../service/models'),
    fetchModelCatalog: () => Promise.resolve({
        models: [{ id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', short_label: '5.6 Terra', pipelines: ['chat', 'deep_research'] }],
        defaultModel: 'gpt-5.6-terra',
        defaultsByPipeline: { chat: 'gpt-5.6-terra', deep_research: 'gpt-5.6-terra' },
        efforts: [],
    }),
}));

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

describe('a guest at the home composer', () => {
    it('is asked to sign in instead of being sent to a chat', () => {
        renderBar();

        startChat();

        expect(mockAuth.openLoginModal).toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('cannot type a question into the box', () => {
        renderBar();
        const box = screen.getByPlaceholderText(/Ask a question about the biomedical literature/i);

        fireEvent.mouseDown(box);
        fireEvent.keyDown(box, { key: 'B' });

        expect(mockAuth.openLoginModal).toHaveBeenCalled();
        expect(box).toHaveValue('');
    });

    it('cannot open the search options either', () => {
        renderBar();

        fireEvent.mouseDown(searchOptionsChip());
        fireEvent.click(searchOptionsChip());

        expect(mockAuth.openLoginModal).toHaveBeenCalled();
        expect(optionsPanels().some((panel) => isVisible(panel))).toBe(false);
    });

    it('sees the composer as it is, not a disabled one', () => {
        renderBar();

        // Nothing about the gate should tell the visitor the product is broken.
        expect(screen.getByPlaceholderText(/Ask a question about the biomedical literature/i))
            .toBeEnabled();
    });
});

describe('a signed-in reader at the same composer', () => {
    it('is taken to the chat with their question', () => {
        mockAuth.isAuthenticated = true;
        renderBar();
        const box = screen.getByPlaceholderText(/Ask a question about the biomedical literature/i);

        fireEvent.change(box, { target: { value: 'What is BRCA1?' } });
        startChat();

        expect(mockNavigate).toHaveBeenCalledWith('/chat', expect.objectContaining({
            state: expect.objectContaining({ initialQuery: 'What is BRCA1?' }),
        }));
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
