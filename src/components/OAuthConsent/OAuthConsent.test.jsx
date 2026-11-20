/**
 * The consent page an outside app (Claude, ChatGPT) sends the reader to (index.jsx).
 *
 * The sign-in is the site's real one — AuthProvider, the overlay and /verify-code — with only
 * the auth service and the oauth client faked, so the way back to this page after an emailed
 * code is exercised end to end.
 */
import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import '@testing-library/jest-dom';

import * as AuthService from '../../service/Auth';

const mockFlags = { enabled: true };
const mockApi = {
    calls: [],
    request: null,
    fetchResults: [],
    approve: null,
    deny: null,
    followed: [],
};

jest.mock('../../config/features', () => ({
    get OAUTH_CONNECT_ENABLED() { return mockFlags.enabled; },
}));
jest.mock('../../service/Auth');
// Plain functions, not jest.fn(): CRA's `resetMocks` would wipe a mock's implementation.
jest.mock('../../service/oauthConnect', () => ({
    NOT_FOUND: 'OAUTH_REQUEST_NOT_FOUND',
    SIGNED_OUT: 'SIGNED_OUT',
    fetchOAuthRequest: (id) => {
        mockApi.calls.push(['fetch', id]);
        const next = mockApi.fetchResults.length ? mockApi.fetchResults.shift() : { ok: true, request: mockApi.request };
        return Promise.resolve(next);
    },
    approveOAuthRequest: (id) => {
        mockApi.calls.push(['approve', id]);
        return Promise.resolve(mockApi.approve);
    },
    denyOAuthRequest: (id) => {
        mockApi.calls.push(['deny', id]);
        return Promise.resolve(mockApi.deny);
    },
    followRedirect: (url) => { mockApi.followed.push(url); },
}));

/* eslint-disable import/first */
import { AuthProvider } from '../Auth/AuthContext';
import VerifyCodePage from '../Auth/VerifyCodePage';
import OAuthConsent from './index';
/* eslint-enable import/first */

const CONSENT_URL = '/oauth/authorize?request=req-1';
const READER = { id: 1, email: 'reader@umich.edu', username: 'Reader' };
const REQUEST = {
    requestId: 'req-1',
    clientName: 'Claude',
    clientUri: null,
    redirectHost: 'claude.ai',
    scopes: [{
        id: 'investigate',
        title: 'Run Investigate reports',
        description: 'Start deep-research reports on your behalf and read the reports it started. Each report uses credits from your GLKB account.',
    }],
    priceCredits: 30,
    creditsRemaining: 1250,
    expiresAt: '2026-11-20T12:10:00Z',
};
const NOT_FOUND_RESULT = { ok: false, status: 404, code: 'OAUTH_REQUEST_NOT_FOUND', message: 'gone' };

function Where() {
    const location = useLocation();
    return <span data-testid="where">{`${location.pathname}${location.search}`}</span>;
}

const renderAt = (path = CONSENT_URL) => render(
    <HelmetProvider>
        <MemoryRouter initialEntries={[path]}>
            <AuthProvider>
                <Routes>
                    <Route path="/oauth/authorize" element={<OAuthConsent />} />
                    <Route path="/verify-code" element={<VerifyCodePage />} />
                    <Route path="/chat" element={<p>The chat</p>} />
                    <Route path="/" element={<p>The home page</p>} />
                </Routes>
                <Where />
            </AuthProvider>
        </MemoryRouter>
    </HelmetProvider>,
);

const signIn = (user = READER) => {
    AuthService.getToken.mockReturnValue('token');
    AuthService.getCurrentUser.mockReturnValue(user);
};

beforeEach(() => {
    mockFlags.enabled = true;
    mockApi.calls = [];
    mockApi.request = REQUEST;
    mockApi.fetchResults = [];
    mockApi.approve = { ok: true, redirectTo: 'https://claude.ai/api/mcp/auth_callback?code=abc&state=s1' };
    mockApi.deny = { ok: true, redirectTo: 'https://claude.ai/api/mcp/auth_callback?error=access_denied&state=s1' };
    mockApi.followed = [];
    AuthService.getToken.mockReturnValue(null);
    AuthService.getCurrentUser.mockReturnValue(null);
    AuthService.logout.mockResolvedValue({ success: true });
});

describe('signed out', () => {
    it('opens the sign-in, and an emailed code brings the reader back to the same request', async () => {
        AuthService.sendVerificationCode.mockResolvedValue({ success: true });
        AuthService.verifyCode.mockResolvedValue({ success: true, user: READER });
        renderAt();

        expect(screen.getByRole('heading', { name: 'Sign in to connect an app' })).toBeInTheDocument();
        // The overlay opens on arrival, saying why.
        const overlay = screen.getByRole('dialog');
        expect(overlay).toHaveTextContent('An app is asking to use your GLKB account');
        expect(mockApi.calls).toEqual([]);

        fireEvent.change(within(overlay).getByPlaceholderText('sarah@university.edu'), { target: { value: 'reader@umich.edu' } });
        fireEvent.click(within(overlay).getByRole('button', { name: 'Continue' }));
        expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
        expect(AuthService.sendVerificationCode).toHaveBeenCalledWith('reader@umich.edu');

        const boxes = screen.getAllByRole('textbox');
        '123456'.split('').forEach((digit, i) => fireEvent.change(boxes[i], { target: { value: digit } }));
        fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

        expect(await screen.findByRole('heading', { name: 'Claude wants to use your GLKB account' })).toBeInTheDocument();
        expect(AuthService.verifyCode).toHaveBeenCalledWith('reader@umich.edu', '123456');
        expect(screen.getByTestId('where')).toHaveTextContent(CONSENT_URL);
        expect(mockApi.calls).toEqual([['fetch', 'req-1']]);
    });

    it('can reopen the sign-in after it was closed', async () => {
        renderAt();
        fireEvent.click(screen.getByRole('button', { name: 'Close sign in' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Sign in to GLKB' }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('signs in again when the server no longer accepts the stored sign-in', async () => {
        signIn();
        mockApi.fetchResults = [{ ok: false, status: 401, code: 'SIGNED_OUT', message: '' }];
        renderAt();
        expect(await screen.findByRole('heading', { name: 'Sign in to connect an app' })).toBeInTheDocument();
        expect(AuthService.logout).toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByTestId('where')).toHaveTextContent(CONSENT_URL);
    });
});

describe('signed in', () => {
    it('shows who is asking, where it returns to, what it may and may not do, the price and the balance', async () => {
        signIn();
        renderAt();
        const card = await screen.findByRole('region', { name: 'Claude wants to use your GLKB account' });
        expect(card).toHaveTextContent('Will return you to claude.ai');
        expect(card).toHaveTextContent('Apps choose their own names. Allow this only if you came here from claude.ai.');
        expect(card).toHaveTextContent('Signed in as reader@umich.edu');
        expect(within(card).getByText('Run Investigate reports')).toBeInTheDocument();
        expect(card).toHaveTextContent('Start deep-research reports on your behalf');
        expect(card).toHaveTextContent('Each report costs30 credits');
        expect(card).toHaveTextContent('You have1,250 credits');
        expect(card).toHaveTextContent('Read your other GLKB conversations');
        expect(card).toHaveTextContent('Change your account or settings');
        expect(card).toHaveTextContent('Spend your credits on anything other than Investigate reports');
        expect(card).not.toHaveTextContent('not enough for a report');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        // The heading takes the focus, so a screen reader starts at what is being asked.
        expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    });

    it('says so when the balance does not cover a report', async () => {
        signIn();
        mockApi.request = { ...REQUEST, creditsRemaining: 10 };
        renderAt();
        expect(await screen.findByText(/That is not enough for a report yet/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Allow' })).toBeEnabled();
    });

    it('Allow approves the request and follows the address the backend returns', async () => {
        signIn();
        renderAt();
        fireEvent.click(await screen.findByRole('button', { name: 'Allow' }));
        expect(await screen.findByRole('status')).toHaveTextContent('Taking you back to claude.ai…');
        expect(mockApi.calls).toEqual([['fetch', 'req-1'], ['approve', 'req-1']]);
        expect(mockApi.followed).toEqual(['https://claude.ai/api/mcp/auth_callback?code=abc&state=s1']);
        expect(screen.queryByRole('button', { name: 'Allow' })).not.toBeInTheDocument();
    });

    it('Don’t allow denies the request and follows the address the backend returns', async () => {
        signIn();
        renderAt();
        fireEvent.click(await screen.findByRole('button', { name: 'Don’t allow' }));
        await waitFor(() => expect(mockApi.followed).toHaveLength(1));
        expect(mockApi.calls).toEqual([['fetch', 'req-1'], ['deny', 'req-1']]);
        expect(mockApi.followed).toEqual(['https://claude.ai/api/mcp/auth_callback?error=access_denied&state=s1']);
    });

    it('keeps the buttons and says so when an answer does not go through', async () => {
        signIn();
        mockApi.approve = { ok: false, status: null, code: 'NETWORK', message: '' };
        renderAt();
        fireEvent.click(await screen.findByRole('button', { name: 'Allow' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('That did not go through');
        expect(screen.getByRole('button', { name: 'Allow' })).toBeEnabled();
        expect(mockApi.followed).toEqual([]);
    });

    it('lets a reader on a shared computer switch account', async () => {
        signIn();
        renderAt();
        fireEvent.click(await screen.findByRole('button', { name: 'Use another account' }));
        expect(await screen.findByRole('heading', { name: 'Sign in to connect an app' })).toBeInTheDocument();
        expect(AuthService.logout).toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
});

describe('a request that cannot be answered', () => {
    const expectDeadEnd = () => {
        expect(screen.getByRole('heading', { name: 'This link has expired' })).toBeInTheDocument();
        expect(screen.getByText(/lasts 10 minutes and can be answered once/)).toBeInTheDocument();
        expect(screen.queryAllByRole('button')).toHaveLength(0);
    };

    it('an unknown, expired or answered request says so, with nothing to press', async () => {
        signIn();
        mockApi.fetchResults = [NOT_FOUND_RESULT];
        renderAt();
        await screen.findByRole('heading', { name: 'This link has expired' });
        expectDeadEnd();
    });

    it('one that expires while the page is open says so when it is answered', async () => {
        signIn();
        mockApi.approve = NOT_FOUND_RESULT;
        renderAt();
        fireEvent.click(await screen.findByRole('button', { name: 'Allow' }));
        await screen.findByRole('heading', { name: 'This link has expired' });
        expectDeadEnd();
        expect(mockApi.followed).toEqual([]);
    });

    it('a link without its request says so, and asks for nothing', async () => {
        signIn();
        renderAt('/oauth/authorize');
        expect(screen.getByRole('heading', { name: 'This link is incomplete' })).toBeInTheDocument();
        expect(screen.queryAllByRole('button')).toHaveLength(0);
        expect(mockApi.calls).toEqual([]);
    });

    it('a request that could not be loaded can be tried again', async () => {
        signIn();
        mockApi.fetchResults = [{ ok: false, status: 502, code: 'HTTP_502', message: '' }];
        renderAt();
        fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
        expect(await screen.findByRole('heading', { name: 'Claude wants to use your GLKB account' })).toBeInTheDocument();
        expect(mockApi.calls).toEqual([['fetch', 'req-1'], ['fetch', 'req-1']]);
    });
});

describe('off on glkb.org', () => {
    it('sends the reader home, and asks the backend nothing', async () => {
        mockFlags.enabled = false;
        signIn();
        renderAt();
        expect(await screen.findByText('The home page')).toBeInTheDocument();
        expect(mockApi.calls).toEqual([]);
    });

    it('is gated like the other new features, and the route goes home when it is off', () => {
        const features = readFileSync(join(__dirname, '../../config/features.js'), 'utf-8');
        expect(features).toContain('export const OAUTH_CONNECT_ENABLED = !isProductionSite();');
        const routes = readFileSync(join(__dirname, '../../index.js'), 'utf-8');
        expect(routes).toContain('path="/oauth/authorize"');
        expect(routes).toContain('element={OAUTH_CONNECT_ENABLED ? <OAuthConsent /> : <Navigate to="/" replace />}');
        // A 401 here must not send the reader to /login, which would lose `?request=`.
        const interceptor = readFileSync(join(__dirname, '../../utils/axiosConfig.js'), 'utf-8');
        expect(interceptor).toContain("!window.location.pathname.startsWith('/oauth/')");
    });
});
