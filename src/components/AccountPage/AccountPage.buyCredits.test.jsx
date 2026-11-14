/**
 * The Account page's money (Figma GLKB-Tokenized 244:5280): the dollar balance with Add funds
 * (a warning, then the U-M store), the credits bought with it (Buy more: presets or a custom
 * count, priced at the backend's rate, refused when the balance is short), and the billing
 * history. With no store configured (`ADD_FUNDS_URL` empty) none of it is offered.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

const mockFeatures = { ADD_FUNDS_URL: 'https://store.example.edu/glkb' };
const mockMoney = {
    balance: { balanceUsd: 100, purchasedCredits: 0 },
    usage: { remaining: 196, monthlyAllowance: 200, monthlyRemaining: 196, purchasedRemaining: 0, resetsAt: null, limitReached: false },
    exchanges: [],
    exchangeResult: null,
    billing: [],
};

jest.mock('../../config/features', () => ({
    get ADD_FUNDS_URL() { return mockFeatures.ADD_FUNDS_URL; },
}));
jest.mock('../Auth/AuthContext', () => ({
    useAuth: () => ({
        user: { email: 'reader@umich.edu', username: 'Reader', avatar_id: 0 },
        logout: () => {},
        updateUsername: () => Promise.resolve(),
        updateAvatar: () => Promise.resolve(),
        refreshUser: () => Promise.resolve(),
    }),
}));
// Plain functions, not jest.fn(): CRA's `resetMocks` would wipe a mock's implementation
// before each test.
jest.mock('../../service/Tier', () => ({
    getMyTier: () => Promise.resolve({ success: true, data: { tier: 'free' } }),
    upgradeToPro: () => Promise.resolve({ success: false }),
}));
jest.mock('../../service/credits', () => ({
    fetchUsage: () => Promise.resolve(mockMoney.usage),
}));
jest.mock('../../service/serviceTiers', () => ({
    DEFAULT_CREDITS_PER_USD: 10,
    fetchTierPricing: () => Promise.resolve({ creditsPerUsd: 10 }),
}));
jest.mock('../../service/balance', () => {
    const actual = jest.requireActual('../../service/balance');
    return {
        ...actual,
        fetchBalance: () => Promise.resolve(mockMoney.balance),
        fetchBilling: () => Promise.resolve(mockMoney.billing),
        exchangeCredits: (args) => {
            mockMoney.exchanges.push(args);
            return Promise.resolve(mockMoney.exchangeResult);
        },
    };
});
jest.mock('../../utils/gtag', () => ({ trackGtagEvent: () => {} }));

// eslint-disable-next-line import/first
import AccountPage, { nextResetText } from './index';

const renderPage = (path = '/account') => render(
    <MemoryRouter initialEntries={[path]}>
        <AccountPage />
    </MemoryRouter>,
);

beforeAll(() => {
    window.matchMedia = window.matchMedia || (() => ({
        matches: false, addListener() {}, removeListener() {},
        addEventListener() {}, removeEventListener() {},
    }));
});

beforeEach(() => {
    mockFeatures.ADD_FUNDS_URL = 'https://store.example.edu/glkb';
    mockMoney.balance = { balanceUsd: 100, purchasedCredits: 0 };
    mockMoney.usage = { remaining: 196, monthlyAllowance: 200, monthlyRemaining: 196, purchasedRemaining: 0, resetsAt: null, limitReached: false };
    mockMoney.exchanges = [];
    mockMoney.exchangeResult = { ok: true, credits: 100, balanceUsd: 90, purchasedCredits: 100 };
    mockMoney.billing = [];
});

it('offers none of it while no store is configured', async () => {
    mockFeatures.ADD_FUNDS_URL = '';
    renderPage();
    await waitFor(() => expect(screen.getByText('Monthly Credits')).toBeInTheDocument());
    ['Balance', 'Additional Credits', 'Billing'].forEach((label) => expect(screen.queryByText(label)).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Add funds' })).not.toBeInTheDocument();
});

it('shows the balance, the month used and left, and no bought credits before the first purchase', async () => {
    renderPage();
    expect(await screen.findByText('$100.00')).toBeInTheDocument();
    expect(screen.getByText('4 used')).toBeInTheDocument();
    expect(screen.getByText('196 remaining')).toBeInTheDocument();
    expect(screen.getByText('Additional Credits')).toBeInTheDocument();
    expect(screen.queryByText(/available$/)).not.toBeInTheDocument();
});

it('says how many bought credits are left once there are some', async () => {
    mockMoney.usage = { ...mockMoney.usage, purchasedRemaining: 200 };
    renderPage();
    expect(await screen.findByText('200 available')).toBeInTheDocument();
});

it('warns before sending the reader to the store, and opens it in a new tab', async () => {
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Add funds' }));
    const dialog = screen.getByRole('dialog', { name: 'Leaving GLKB' });
    expect(dialog).toHaveTextContent('Innovation Partnerships');
    // The store's payment finds the account by the checkout email.
    expect(dialog).toHaveTextContent('Check out with reader@umich.edu');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(open).toHaveBeenCalledWith('https://store.example.edu/glkb', '_blank', 'noopener,noreferrer');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    open.mockRestore();
});

it('prices a preset, buys it once with a request id, and says it worked', async () => {
    renderPage();
    await screen.findByText('$100.00');
    fireEvent.click(screen.getByRole('button', { name: 'Buy more' }));
    const dialog = screen.getByRole('dialog', { name: 'Buy more credits' });
    expect(within(dialog).getByRole('radio', { name: '100' })).toHaveAttribute('aria-checked', 'true');
    expect(dialog).toHaveTextContent('Total: $10.00');
    expect(dialog).toHaveTextContent('You’ll have $90.00 left.');
    fireEvent.click(within(dialog).getByRole('radio', { name: '500' }));
    expect(dialog).toHaveTextContent('Total: $50.00');
    expect(dialog).toHaveTextContent('You’ll have $50.00 left.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Purchase' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockMoney.exchanges).toHaveLength(1);
    expect(mockMoney.exchanges[0].credits).toBe(500);
    expect(mockMoney.exchanges[0].requestId).toMatch(/\S{8,}/);
    expect(screen.getByRole('status')).toHaveTextContent('100 credits added');
});

it('refuses a custom count that is not a whole number, and a purchase the balance cannot cover', async () => {
    renderPage();
    await screen.findByText('$100.00');
    fireEvent.click(screen.getByRole('button', { name: 'Buy more' }));
    const dialog = screen.getByRole('dialog', { name: 'Buy more credits' });
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Custom' }));
    expect(dialog).toHaveTextContent('Total: —');
    const input = within(dialog).getByRole('textbox', { name: 'Number of credits' });
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(dialog).toHaveTextContent('Please enter a valid number.');
    expect(within(dialog).getByRole('button', { name: 'Purchase' })).toBeDisabled();
    fireEvent.change(input, { target: { value: '200' } });
    expect(dialog).toHaveTextContent('Total: $20.00');
    expect(within(dialog).getByRole('button', { name: 'Purchase' })).toBeEnabled();
    fireEvent.change(input, { target: { value: '1500' } });
    expect(dialog).toHaveTextContent('Insufficient funds.');
    expect(within(dialog).getByRole('button', { name: 'Purchase' })).toBeDisabled();
    expect(mockMoney.exchanges).toHaveLength(0);
});

it('opens Buy more on arrival from the chat’s Buy credits link', async () => {
    renderPage('/account?buy=credits');
    expect(await screen.findByRole('dialog', { name: 'Buy more credits' })).toBeInTheDocument();
});

it('lists the payments into the account', async () => {
    mockMoney.billing = [
        { id: 2, date: '2026-06-01T15:00:00', amountUsd: 200, status: 'Paid' },
        { id: 1, date: '2026-05-27T15:00:00', amountUsd: 100, status: 'Paid' },
    ];
    renderPage();
    await screen.findByText('$100.00');
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    const dialog = await screen.findByRole('dialog', { name: 'Billing' });
    await waitFor(() => expect(within(dialog).getAllByRole('row')).toHaveLength(3));
    expect(dialog).toHaveTextContent('Jun 1, 2026');
    expect(dialog).toHaveTextContent('$200.00');
    expect(dialog).toHaveTextContent('Paid');
});

it('counts the days to the reset and names the 1st in UTC', () => {
    const resets = new Date('2026-12-01T00:00:00Z');
    expect(nextResetText(resets, new Date('2026-11-21T00:00:00Z'))).toBe('Next reset in 10 days (Dec 1)');
    expect(nextResetText(resets, new Date('2026-11-30T12:00:00Z'))).toBe('Next reset tomorrow (Dec 1)');
});
