/**
 * The home composer at the five effort levels (the three-repo effort contract, 2026-11-05): what
 * the menu offers once the backend lists its levels, what a question is handed over with, and the
 * guest's sign-in for High.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import LlmSearchBarHome from './LlmSearchBarHome';
import { setServerEfforts } from '../../service/effortLevels';
import { GUEST_HIGH_REASON } from '../../utils/refusals';

const mockAuth = { isAuthenticated: true, loading: false, openLoginModal: jest.fn() };
const mockNavigate = jest.fn();
let mockWithEfforts = true;

jest.mock('../Auth/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));
jest.mock('../../service/LiteratureReview', () => ({}));
jest.mock('../../config/features', () => ({
    INVESTIGATE_ENABLED: true,
    LITERATURE_REVIEW_ENABLED: false,
    isProductionSite: () => false,
}));
const mockEfforts = [
    { id: 'low', pipeline: 'chat', enabled: true, guest: true, default: false, prices: { standard: 1, advanced: 2, premium: 5 } },
    { id: 'medium', pipeline: 'chat', enabled: true, guest: true, default: true, prices: { standard: 1, advanced: 5, premium: 10 } },
    { id: 'high', pipeline: 'chat', enabled: true, guest: false, default: false, prices: { standard: 3, advanced: 10, premium: 20 } },
    { id: 'extra', pipeline: 'deep_research', enabled: true, guest: false, default: true, prices: { standard: 20, advanced: 30, premium: 45 } },
    { id: 'max', pipeline: 'deep_research', enabled: true, guest: false, default: false, prices: { standard: 40, advanced: 60, premium: 90 } },
];
// As the real fetch does: parse the pricing, and hand its levels to effortLevels.js.
jest.mock('../../service/serviceTiers', () => {
    const actual = jest.requireActual('../../service/serviceTiers');
    const levels = jest.requireActual('../../service/effortLevels');
    return {
        ...actual,
        fetchTierPricing: () => {
            const parsed = actual.parsePricing({
                ...actual.FALLBACK_PRICING,
                ...(mockWithEfforts ? { efforts: mockEfforts } : {}),
            });
            levels.setServerEfforts(parsed.efforts);
            return Promise.resolve(parsed);
        },
        getTierPref: () => '',
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
    mockNavigate.mockClear();
    mockAuth.isAuthenticated = true;
    mockAuth.openLoginModal = jest.fn();
    mockWithEfforts = true;
    setServerEfforts(null);
});

const setup = () => render(<LlmSearchBarHome setOpen={() => {}} autocompleteOptions={[]} />);
const effortChip = () => document.querySelector('button.effort-chip');
const levelRow = (name) => Array.from(document.querySelectorAll('.effort-level-row'))
    .find((row) => row.querySelector('.effort-level-label').textContent.startsWith(name));
const openLevels = async () => {
    await waitFor(() => expect(effortChip()).not.toBeDisabled());
    fireEvent.click(effortChip());
    fireEvent.click(document.querySelector('.effort-sub-row'));
};
const chooseLevel = async (name) => {
    await openLevels();
    fireEvent.click(levelRow(name));
};
const submit = () => {
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'What does TP53 do?' } });
    fireEvent.click(screen.getByRole('button', { name: /start chat/i, hidden: true }));
    return mockNavigate.mock.calls[0][1].state.initialSearchOptions;
};

it('offers all five once the backend lists them', async () => {
    setup();
    await openLevels();
    ['Low', 'Medium', 'High', 'Extra', 'Max'].forEach((name) => expect(levelRow(name)).toHaveAttribute('aria-disabled', 'false'));
});

it('offers Medium and Extra only from a backend that lists none', async () => {
    mockWithEfforts = false;
    setup();
    await openLevels();
    expect(levelRow('High')).toHaveAttribute('aria-disabled', 'true');
    expect(levelRow('Extra')).toHaveAttribute('aria-disabled', 'false');
});

it('hands a High question over on the chat pipeline, with its level, priced at High', async () => {
    setup();
    await chooseLevel('High');
    expect(effortChip()).toHaveTextContent('GPT-6.1 Terra · High');
    fireEvent.click(effortChip());
    expect(Array.from(document.querySelectorAll('.effort-model-desc')).map((n) => n.textContent))
        .toEqual(['Most capable · 20 credits', 'Balanced speed and depth · 10 credits', 'Fastest and cheapest · 3 credits']);
    fireEvent.click(effortChip());
    expect(submit()).toMatchObject({ investigateEnabled: false, effort: 'high' });
});

it('hands a Max question over on deep research', async () => {
    setup();
    await chooseLevel('Max');
    expect(submit()).toMatchObject({ investigateEnabled: true, effort: 'max' });
});

it('hands a Medium question over exactly as before: no level named', async () => {
    setup();
    await waitFor(() => expect(effortChip()).not.toBeDisabled());
    expect(submit()).not.toHaveProperty('effort');
});

it('asks a guest who picks High to sign in, with High\'s own reason', async () => {
    mockAuth.isAuthenticated = false;
    setup();
    await chooseLevel('High');
    expect(mockAuth.openLoginModal).toHaveBeenCalledWith(GUEST_HIGH_REASON);
    expect(effortChip()).toHaveTextContent('· Medium');
});
