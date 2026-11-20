/**
 * The Account page's "Connected apps" (ConnectedApps.jsx): the outside apps the reader let use the
 * account on the consent page, each with Disconnect, which asks first.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

const mockFeatures = { ADD_FUNDS_URL: '', OAUTH_CONNECT_ENABLED: true };
const mockOAuth = {
    grants: [],
    listResult: null,
    revoked: [],
    revokeResult: { ok: true },
    listCalls: 0,
};

jest.mock('../../config/features', () => ({
    get ADD_FUNDS_URL() { return mockFeatures.ADD_FUNDS_URL; },
    get OAUTH_CONNECT_ENABLED() { return mockFeatures.OAUTH_CONNECT_ENABLED; },
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
// Plain functions, not jest.fn(): CRA's `resetMocks` would wipe a mock's implementation.
jest.mock('../../service/Tier', () => ({
    getMyTier: () => Promise.resolve({ success: true, data: { tier: 'free' } }),
    upgradeToPro: () => Promise.resolve({ success: false }),
}));
jest.mock('../../service/credits', () => ({
    fetchUsage: () => Promise.resolve({ remaining: 196, monthlyAllowance: 200, monthlyRemaining: 196, purchasedRemaining: 0, resetsAt: null, limitReached: false }),
}));
jest.mock('../../service/serviceTiers', () => ({
    DEFAULT_CREDITS_PER_USD: 10,
    fetchTierPricing: () => Promise.resolve({ creditsPerUsd: 10 }),
}));
jest.mock('../../utils/gtag', () => ({ trackGtagEvent: () => {} }));
jest.mock('../../service/oauthConnect', () => {
    const actual = jest.requireActual('../../service/oauthConnect');
    return {
        NOT_FOUND: actual.NOT_FOUND,
        scopeTitle: actual.scopeTitle,
        fetchGrants: () => {
            mockOAuth.listCalls += 1;
            return Promise.resolve(mockOAuth.listResult || { ok: true, grants: mockOAuth.grants });
        },
        revokeGrant: (id) => {
            mockOAuth.revoked.push(id);
            return Promise.resolve(mockOAuth.revokeResult);
        },
    };
});

// eslint-disable-next-line import/first
import AccountPage from './index';

const renderPage = () => render(
    <MemoryRouter initialEntries={['/account']}>
        <AccountPage />
    </MemoryRouter>,
);

const CLAUDE = {
    grantId: 'g-1',
    clientName: 'Claude',
    scopes: ['investigate'],
    createdAt: '2026-11-18T15:00:00',
    lastUsedAt: '2026-11-19T15:00:00',
};
const CHATGPT = {
    grantId: 'g-2',
    clientName: 'ChatGPT',
    scopes: ['investigate'],
    createdAt: '2026-11-20T15:00:00',
    lastUsedAt: null,
};

beforeAll(() => {
    window.matchMedia = window.matchMedia || (() => ({
        matches: false, addListener() {}, removeListener() {},
        addEventListener() {}, removeEventListener() {},
    }));
});

beforeEach(() => {
    mockFeatures.OAUTH_CONNECT_ENABLED = true;
    mockOAuth.grants = [CLAUDE, CHATGPT];
    mockOAuth.listResult = null;
    mockOAuth.revoked = [];
    mockOAuth.revokeResult = { ok: true };
    mockOAuth.listCalls = 0;
});

it('lists each connected app with what it can do and when it was connected and last used', async () => {
    renderPage();
    const list = await screen.findByRole('list', { name: 'Connected apps' });
    expect(screen.getByRole('heading', { name: 'Connected apps' })).toBeInTheDocument();
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Claude');
    expect(rows[0]).toHaveTextContent('Can run Investigate reports');
    expect(rows[0]).toHaveTextContent('Connected Nov 18, 2026 · Last used Nov 19, 2026');
    expect(rows[1]).toHaveTextContent('ChatGPT');
    expect(rows[1]).toHaveTextContent('Connected Nov 20, 2026 · Not used yet');
});

it('asks before disconnecting, and Cancel leaves the app connected', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect Claude' }));
    const dialog = screen.getByRole('dialog', { name: 'Disconnect Claude?' });
    expect(dialog).toHaveTextContent('Claude will no longer be able to use your GLKB account.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockOAuth.revoked).toEqual([]);
    expect(screen.getByRole('button', { name: 'Disconnect Claude' })).toBeInTheDocument();
});

it('disconnects on confirmation: the app leaves the list and the page says so', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect Claude' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockOAuth.revoked).toEqual(['g-1']);
    expect(screen.queryByRole('button', { name: 'Disconnect Claude' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disconnect ChatGPT' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Claude disconnected');
});

it('keeps the app and says so when disconnecting fails', async () => {
    mockOAuth.revokeResult = { ok: false, status: 502, code: 'HTTP_502', message: '' };
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect Claude' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Disconnect' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('could not be disconnected');
    expect(screen.getByRole('button', { name: 'Disconnect Claude' })).toBeInTheDocument();
});

it('treats an app that is already gone as disconnected', async () => {
    mockOAuth.revokeResult = { ok: false, status: 404, code: 'HTTP_404', message: '' };
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect Claude' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Disconnect Claude' })).not.toBeInTheDocument());
});

it('says nothing is connected when the list is empty', async () => {
    mockOAuth.grants = [];
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Connected apps' })).toBeInTheDocument();
    expect(screen.getByText(/No apps are connected/)).toBeInTheDocument();
});

it('leaves the section out when the list cannot be read', async () => {
    mockOAuth.listResult = { ok: false, status: 404, code: 'HTTP_404', message: '' };
    renderPage();
    await waitFor(() => expect(mockOAuth.listCalls).toBe(1));
    await screen.findByText('Monthly Credits');
    expect(screen.queryByRole('heading', { name: 'Connected apps' })).not.toBeInTheDocument();
});

it('is not there at all on glkb.org', async () => {
    mockFeatures.OAUTH_CONNECT_ENABLED = false;
    renderPage();
    await screen.findByText('Monthly Credits');
    expect(screen.queryByRole('heading', { name: 'Connected apps' })).not.toBeInTheDocument();
    expect(mockOAuth.listCalls).toBe(0);
});
