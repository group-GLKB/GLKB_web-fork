/**
 * Connecting GLKB to an outside app (glkb-backend `/api/v1/oauth`, 2026-11-20).
 *
 * An MCP client (Claude, ChatGPT, ...) that wants to run Investigate reports with a reader's
 * account sends the browser to the backend's `/oauth/authorize`. The backend checks the request
 * and hands the browser to this app at `/oauth/authorize?request=<request_id>`, where the reader
 * signs in, reads what the app is asking for, and allows or denies it
 * (components/OAuthConsent). The Account page lists what has been allowed and can take it back
 * (components/AccountPage/ConnectedApps.jsx).
 *
 *   GET    /requests/{id}           what is being asked, by whom, and what a report costs
 *   POST   /requests/{id}/approve   -> { redirect_to }
 *   POST   /requests/{id}/deny      -> { redirect_to }
 *   GET    /grants                  the apps the reader has allowed
 *   DELETE /grants/{id}             takes one back (every token it was given stops working)
 *
 * All of them need the reader's GLKB sign-in. `redirect_to` is the CLIENT's own address with the
 * answer on it; it is followed as given and never assembled here.
 *
 * Every call resolves, never rejects: `{ ok: true, ... }` or `{ ok: false, status, code, message }`.
 * `code` is the backend's (OAUTH_REQUEST_NOT_FOUND) where it sent one, else SIGNED_OUT (401),
 * NETWORK (no answer) or HTTP_<status>.
 */
import axios from '../utils/axiosConfig';

const BASE = '/api/v1/oauth';

export const NOT_FOUND = 'OAUTH_REQUEST_NOT_FOUND';
export const SIGNED_OUT = 'SIGNED_OUT';

const num = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const text = (value) => (typeof value === 'string' ? value.trim() : '');

const failure = (error) => {
    const status = error?.response?.status ?? null;
    const detail = error?.response?.data?.detail;
    const body = detail && typeof detail === 'object' ? detail : {};
    let code = body.code || null;
    if (!code) {
        if (status === 401) code = SIGNED_OUT;
        else if (status === 404) code = NOT_FOUND;
        else code = status ? `HTTP_${status}` : 'NETWORK';
    }
    return {
        ok: false,
        status,
        code,
        message: body.message || (typeof detail === 'string' ? detail : ''),
    };
};

export const parseRequest = (data) => ({
    requestId: text(data?.request_id),
    clientName: text(data?.client_name),
    clientUri: text(data?.client_uri) || null,
    redirectHost: text(data?.redirect_host),
    scopes: (Array.isArray(data?.scopes) ? data.scopes : [])
        .filter((scope) => scope && (scope.id || scope.title))
        .map((scope) => ({
            id: text(scope.id),
            title: text(scope.title) || text(scope.id),
            description: text(scope.description),
        })),
    priceCredits: num(data?.price_credits),
    creditsRemaining: num(data?.credits_remaining),
    expiresAt: data?.expires_at || null,
});

/**
 * Whether the browser may be sent to `url`. The address is the client's, and an MCP client may
 * register a custom scheme of its own (`cursor://...`), so this is not an https-only test: it
 * refuses only what would run or read something on THIS site instead of leaving it.
 */
// eslint-disable-next-line no-script-url
const NEVER_FOLLOW = new Set(['javascript:','data:', 'vbscript:', 'blob:', 'file:', 'about:']);
export const isFollowableRedirect = (url) => {
    if (typeof url !== 'string' || !url.trim()) return false;
    try {
        return !NEVER_FOLLOW.has(new URL(url.trim()).protocol.toLowerCase());
    } catch (error) {
        return false; // relative or malformed: not a client's callback
    }
};

const pathFor = (requestId) => `${BASE}/requests/${encodeURIComponent(requestId)}`;

export const fetchOAuthRequest = (requestId) => axios.get(pathFor(requestId))
    .then((response) => ({ ok: true, request: parseRequest(response?.data) }))
    .catch(failure);

const answer = (requestId, verb) => axios.post(`${pathFor(requestId)}/${verb}`)
    .then((response) => {
        const redirectTo = response?.data?.redirect_to;
        if (!isFollowableRedirect(redirectTo)) {
            return { ok: false, status: response?.status ?? null, code: 'BAD_REDIRECT', message: '' };
        }
        return { ok: true, redirectTo: redirectTo.trim() };
    })
    .catch(failure);

export const approveOAuthRequest = (requestId) => answer(requestId, 'approve');
export const denyOAuthRequest = (requestId) => answer(requestId, 'deny');

/** Sends the browser on to the client with its answer. Its own function so tests can stand in. */
export const followRedirect = (url) => window.location.assign(url);

export const parseGrant = (data) => ({
    grantId: data?.grant_id === undefined || data?.grant_id === null ? '' : String(data.grant_id),
    clientName: text(data?.client_name),
    scopes: (Array.isArray(data?.scopes) ? data.scopes : []).map((scope) => text(scope)).filter(Boolean),
    createdAt: data?.created_at || null,
    lastUsedAt: data?.last_used_at || null,
});

export const fetchGrants = () => axios.get(`${BASE}/grants`)
    .then((response) => ({
        ok: true,
        grants: (Array.isArray(response?.data?.grants) ? response.data.grants : [])
            .map(parseGrant)
            .filter((grant) => grant.grantId),
    }))
    .catch(failure);

export const revokeGrant = (grantId) => axios.delete(`${BASE}/grants/${encodeURIComponent(grantId)}`)
    .then(() => ({ ok: true }))
    .catch(failure);

/**
 * What a scope id means in words, for the Account page, which is given ids only. The consent page
 * shows the backend's own title and description instead.
 */
export const SCOPE_TITLES = {
    investigate: 'Run Investigate reports',
};

export const scopeTitle = (id) => SCOPE_TITLES[id] || id;
