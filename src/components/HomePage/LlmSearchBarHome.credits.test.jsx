/**
 * The home composer and the reader's credits (Units/CreditNotice). On 2026-11-02 an Investigate
 * question with 10 credits left (it costs 30 on Terra) went ahead, was refused by the backend
 * and left an empty conversation. Now the box says so, and sending opens a pop-up instead.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import LlmSearchBarHome from './LlmSearchBarHome';
import { setEffortPref } from '../../service/effortLevels';

const mockNavigate = jest.fn();
let mockUsage = null;
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../../utils/gtag', () => ({ trackGtagEvent: jest.fn() }));
jest.mock('../../service/LiteratureReview', () => ({}));
jest.mock('../Auth/AuthContext', () => ({
    useAuth: () => ({ isAuthenticated: true, loading: false, openLoginModal: jest.fn() }),
}));
jest.mock('../../config/features', () => ({
    INVESTIGATE_ENABLED: true,
    LITERATURE_REVIEW_ENABLED: false,
    CREDITS_PURCHASE_URL: '',
}));
jest.mock('../../service/serviceTiers', () => {
    const actual = jest.requireActual('../../service/serviceTiers');
    return {
        ...actual,
        fetchTierPricing: () => Promise.resolve(actual.parsePricing(actual.FALLBACK_PRICING)),
        getTierPref: () => '',
        setTierPref: jest.fn(),
    };
});
jest.mock('../../service/credits', () => {
    const actual = jest.requireActual('../../service/credits');
    return { ...actual, getUsageSnapshot: () => mockUsage };
});

const { parseCredits } = jest.requireActual('../../service/credits');

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
    onCreditNotice.mockClear();
    mockUsage = parseCredits({
        remaining: 10, monthly_allowance: 100, monthly_remaining: 10, resets_at: '2026-12-01T00:00:00',
    });
});

// The bar prices the mode and model; the page draws the notice under its news strip.
const onCreditNotice = jest.fn();
const lastNotice = () => onCreditNotice.mock.calls[onCreditNotice.mock.calls.length - 1][0];
const setup = async () => {
    const view = render(
        <LlmSearchBarHome setOpen={() => {}} autocompleteOptions={[]} onCreditNotice={onCreditNotice} />,
    );
    await act(async () => {});            // the prices
    return view;
};
// Investigate is the composer's Extra effort (service/effortLevels.js).
const chooseExtra = () => act(() => { setEffortPref('extra'); });
const ask = (text) => {
    fireEvent.change(screen.getByRole('combobox'), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: /start chat/i, hidden: true }));
};

it('warns quietly in Chat when a fifth of the month is left, and still sends', async () => {
    await setup();
    expect(lastNotice()).toMatchObject({ level: 'low', brief: '10 credits left · resets Dec 1' });
    ask('What does TP53 do?');
    expect(mockNavigate).toHaveBeenCalled();
});

it('says Investigate cannot be paid for, and pops up instead of opening a conversation', async () => {
    await setup();
    chooseExtra();
    expect(lastNotice()).toMatchObject({ level: 'short', brief: 'Investigate needs 30 credits · 10 left' });
    ask('Map resistance mechanisms of KRAS G12C inhibitors');
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('Not enough credits');
    expect(screen.getByRole('dialog')).toHaveTextContent(
        'An Investigate run on GPT-6.1 Terra costs 30 credits and you have 10 left.',
    );
    // The question stays in the box (behind the modal, so aria-hidden).
    expect(screen.getByRole('combobox', { hidden: true })).toHaveValue('Map resistance mechanisms of KRAS G12C inhibitors');
});

it('says nothing with plenty left', async () => {
    mockUsage = parseCredits({ remaining: 80, monthly_allowance: 100, resets_at: '2026-12-01T00:00:00' });
    await setup();
    chooseExtra();
    expect(lastNotice()).toBeNull();
});
