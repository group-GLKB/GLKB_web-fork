/**
 * The home composer on a phone (the phone design): the mode is a pill in the bottom row that opens
 * a "Choose how GLKB works" sheet, the Options icon opens a sheet holding the model (in every mode)
 * and the search controls (in Chat), and a review's scope is set on the review page, not here.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import LlmSearchBarHome from './LlmSearchBarHome';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));
jest.mock('../../service/LiteratureReview', () => ({}));
jest.mock('../Auth/AuthContext', () => ({
    useAuth: () => ({ isAuthenticated: true, loading: false, openLoginModal: jest.fn() }),
}));
jest.mock('../../config/features', () => ({ INVESTIGATE_ENABLED: true, LITERATURE_REVIEW_ENABLED: true }));
jest.mock('../../service/serviceTiers', () => {
    const actual = jest.requireActual('../../service/serviceTiers');
    return {
        ...actual,
        fetchTierPricing: () => Promise.resolve(actual.parsePricing(actual.FALLBACK_PRICING)),
        getTierPref: () => '',
        setTierPref: jest.fn(),
    };
});

// Every media query is the phone's.
beforeAll(() => {
    window.matchMedia = (query) => ({
        matches: query.includes('max-width'), media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    });
});

beforeEach(() => {
    mockNavigate.mockClear();
    window.localStorage.clear();
});

const setup = () => render(<LlmSearchBarHome setOpen={() => {}} autocompleteOptions={[]} />);
const pill = () => screen.getByRole('button', { name: /^Mode:/, hidden: true });
const sheet = () => screen.getByRole('dialog', { name: 'Choose how GLKB works' });
const pickMode = (name) => {
    fireEvent.click(pill());
    fireEvent.click(within(sheet()).getByRole('option', { name: new RegExp(name) }));
};
const send = () => screen.getByRole('button', { name: /start chat/i, hidden: true });

it('picks the mode from a sheet, not from tabs', () => {
    setup();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(pill()).toHaveAccessibleName('Mode: Chat');
    fireEvent.click(pill());
    const rows = within(sheet()).getAllByRole('option');
    // Investigate is the Extra effort now, picked in the Options sheet.
    expect(rows.map((r) => r.textContent)).toEqual([
        expect.stringContaining('Chat'), expect.stringContaining('Literature Review'),
    ]);
    expect(rows[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(rows[1]);
    expect(pill()).toHaveAccessibleName('Mode: Literature Review');
});

it('marks the pill until the sheet has been opened once', () => {
    const { unmount } = setup();
    expect(document.querySelector('.composer-mode-pill-dot')).not.toBeNull();
    fireEvent.click(pill());
    expect(document.querySelector('.composer-mode-pill-dot')).toBeNull();
    unmount();
    setup();
    expect(document.querySelector('.composer-mode-pill-dot')).toBeNull();
});

it('sends a review topic to the review page, where its scope is set', () => {
    setup();
    pickMode('Literature Review');
    expect(screen.queryByRole('button', { name: /^Length:/, hidden: true })).toBeNull();
    expect(send()).toHaveTextContent('Start');
    fireEvent.change(screen.getByRole('combobox', { hidden: true }), { target: { value: 'p53 and chemoresistance' } });
    fireEvent.click(send());
    expect(mockNavigate).toHaveBeenCalledWith('/literature-review', expect.objectContaining({
        state: expect.objectContaining({ initialQuery: 'p53 and chemoresistance' }),
    }));
});

it('keeps the model and the effort in the Options sheet, in every mode', async () => {
    setup();
    const options = screen.getByRole('button', { name: 'Options', hidden: true });
    fireEvent.click(options);
    await waitFor(() => expect(screen.getByRole('listbox', { name: 'Model', hidden: true })).toBeInTheDocument());
    expect(screen.getByText('Research tools')).toBeInTheDocument();
    expect(screen.getAllByText('Article type').length).toBeGreaterThan(0);
    // the effort, picked here on a phone
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Extra/, hidden: true }));
    expect(screen.getByRole('menuitemradio', { name: /^Extra/, hidden: true })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/Extra runs its own multi-channel retrieval/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('Done')[0]);

    pickMode('Literature Review');
    fireEvent.click(screen.getByRole('button', { name: 'Options', hidden: true }));
    expect(screen.getByRole('listbox', { name: 'Model', hidden: true })).toBeInTheDocument();
    // A review has no tools, filters or effort: only the model is offered.
    expect(screen.queryByText('Research tools')).toBeNull();
    expect(screen.queryAllByRole('menuitemradio', { name: /^Extra/, hidden: true })).toHaveLength(0);
    expect(screen.queryAllByRole('button', { name: 'Reset', hidden: true })).toHaveLength(0);
});
