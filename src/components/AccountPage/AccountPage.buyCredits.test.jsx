/**
 * The Account page's "Buy credits" entry (config/features.js `CREDITS_PURCHASE_URL`).
 *
 * The backend already credits an e-Lucid purchase by the buyer's email; what the web app needs
 * is a way there. With no store URL configured there is nowhere to send the reader, so the row
 * must not exist at all; with one, it links out and says which email to check out with.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

const mockFeatures = { CREDITS_PURCHASE_URL: '' };

jest.mock('../../config/features', () => ({
    get CREDITS_PURCHASE_URL() { return mockFeatures.CREDITS_PURCHASE_URL; },
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
    fetchUsage: () => Promise.resolve({
        remaining: 90, monthlyAllowance: 100, monthlyRemaining: 90, purchasedRemaining: 0,
        resetsAt: null, limitReached: false,
    }),
}));
jest.mock('../../utils/gtag', () => ({ trackGtagEvent: () => {} }));

// eslint-disable-next-line import/first
import AccountPage from './index';

const renderPage = () => render(
    <MemoryRouter initialEntries={['/account']}>
        <AccountPage />
    </MemoryRouter>,
);

beforeAll(() => {
    window.matchMedia = window.matchMedia || (() => ({
        matches: false, addListener() {}, removeListener() {},
        addEventListener() {}, removeEventListener() {},
    }));
});

it('shows no Buy credits entry while no store is configured', async () => {
    mockFeatures.CREDITS_PURCHASE_URL = '';
    renderPage();
    await waitFor(() => expect(screen.getByText('Monthly Credits')).toBeInTheDocument());
    expect(screen.queryByText('Buy Credits')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Buy credits' })).not.toBeInTheDocument();
});

it('links to the store and names the email to check out with once one is', async () => {
    mockFeatures.CREDITS_PURCHASE_URL = 'https://store.example.edu/glkb-credits';
    renderPage();
    const link = await screen.findByRole('link', { name: 'Buy credits' });
    expect(link).toHaveAttribute('href', 'https://store.example.edu/glkb-credits');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByText(/\$10 = 100 credits, never expire\. Check out with reader@umich\.edu\./))
        .toBeInTheDocument();
});
