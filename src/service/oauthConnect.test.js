/**
 * The client for glkb-backend `/api/v1/oauth` (service/oauthConnect.js): the paths it calls, what
 * it makes of the answers, and the redirects it refuses to follow.
 */
import axios from '../utils/axiosConfig';
import {
    approveOAuthRequest,
    denyOAuthRequest,
    fetchGrants,
    fetchOAuthRequest,
    isFollowableRedirect,
    NOT_FOUND,
    revokeGrant,
    scopeTitle,
    SIGNED_OUT,
} from './oauthConnect';

jest.mock('../utils/axiosConfig', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

const httpError = (status, data) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });

it('reads a request: who asks, where it returns to, the scopes, the price and the balance', async () => {
    axios.get.mockResolvedValueOnce({
        data: {
            request_id: 'req-1',
            client_name: ' Claude ',
            client_uri: null,
            redirect_host: 'claude.ai',
            scopes: [{ id: 'investigate', title: 'Run Investigate reports', description: 'Start deep-research reports.' }],
            price_credits: 30,
            credits_remaining: 1250,
            expires_at: '2026-11-20T12:10:00Z',
        },
    });
    const result = await fetchOAuthRequest('req/1');
    expect(axios.get).toHaveBeenCalledWith('/api/v1/oauth/requests/req%2F1');
    expect(result).toEqual({
        ok: true,
        request: {
            requestId: 'req-1',
            clientName: 'Claude',
            clientUri: null,
            redirectHost: 'claude.ai',
            scopes: [{ id: 'investigate', title: 'Run Investigate reports', description: 'Start deep-research reports.' }],
            priceCredits: 30,
            creditsRemaining: 1250,
            expiresAt: '2026-11-20T12:10:00Z',
        },
    });
});

it('names an unknown, expired or answered request, and a lost sign-in', async () => {
    axios.get.mockRejectedValueOnce(httpError(404, { detail: { code: 'OAUTH_REQUEST_NOT_FOUND', message: 'gone' } }));
    expect(await fetchOAuthRequest('x')).toMatchObject({ ok: false, status: 404, code: NOT_FOUND, message: 'gone' });
    axios.get.mockRejectedValueOnce(httpError(401, { detail: 'Not authenticated' }));
    expect(await fetchOAuthRequest('x')).toMatchObject({ ok: false, status: 401, code: SIGNED_OUT });
    axios.get.mockRejectedValueOnce(new Error('Network Error'));
    expect(await fetchOAuthRequest('x')).toMatchObject({ ok: false, status: null, code: 'NETWORK' });
    axios.get.mockRejectedValueOnce(httpError(502, {}));
    expect(await fetchOAuthRequest('x')).toMatchObject({ ok: false, code: 'HTTP_502' });
});

it('answers with approve and deny, and hands back the address to follow as given', async () => {
    const back = 'https://claude.ai/api/mcp/auth_callback?code=abc&state=xyz';
    axios.post.mockResolvedValueOnce({ status: 200, data: { redirect_to: back } });
    expect(await approveOAuthRequest('req-1')).toEqual({ ok: true, redirectTo: back });
    expect(axios.post).toHaveBeenLastCalledWith('/api/v1/oauth/requests/req-1/approve');

    const denied = 'https://claude.ai/api/mcp/auth_callback?error=access_denied&state=xyz';
    axios.post.mockResolvedValueOnce({ status: 200, data: { redirect_to: denied } });
    expect(await denyOAuthRequest('req-1')).toEqual({ ok: true, redirectTo: denied });
    expect(axios.post).toHaveBeenLastCalledWith('/api/v1/oauth/requests/req-1/deny');
});

it('refuses to follow an address that would run something on this site', async () => {
    // eslint-disable-next-line no-script-url
    axios.post.mockResolvedValueOnce({ status: 200, data: { redirect_to: 'javascript:alert(1)' } });
    expect(await approveOAuthRequest('req-1')).toMatchObject({ ok: false, code: 'BAD_REDIRECT' });
    expect(isFollowableRedirect('https://chatgpt.com/connector/oauth/abc')).toBe(true);
    expect(isFollowableRedirect('http://localhost:33418/callback?code=1')).toBe(true);
    // A native client's own scheme is the client's business.
    expect(isFollowableRedirect('cursor://anysphere.cursor-retrieval/oauth/callback?code=1')).toBe(true);
    ['data:text/html,hi', 'vbscript:x', 'file:///etc/passwd', '/chat', '', null].forEach(
        (url) => expect(isFollowableRedirect(url)).toBe(false),
    );
});

it('lists the grants and revokes one', async () => {
    axios.get.mockResolvedValueOnce({
        data: {
            grants: [
                { grant_id: 7, client_name: 'Claude', scopes: ['investigate'], created_at: '2026-11-20T10:00:00', last_used_at: null },
                { client_name: 'no id' },
            ],
        },
    });
    expect(await fetchGrants()).toEqual({
        ok: true,
        grants: [{ grantId: '7', clientName: 'Claude', scopes: ['investigate'], createdAt: '2026-11-20T10:00:00', lastUsedAt: null }],
    });
    expect(axios.get).toHaveBeenLastCalledWith('/api/v1/oauth/grants');

    axios.delete.mockResolvedValueOnce({ status: 204 });
    expect(await revokeGrant('7')).toEqual({ ok: true });
    expect(axios.delete).toHaveBeenLastCalledWith('/api/v1/oauth/grants/7');
});

it('says what a scope id means', () => {
    expect(scopeTitle('investigate')).toBe('Run Investigate reports');
    expect(scopeTitle('something_new')).toBe('something_new');
});
