/**
 * How much a reader has left to ask with.
 *
 * Two kinds of allowance since the credit system (glkb-backend docs/frontend-credits.md):
 *
 *   signed in  credits — `GET /api/v1/credits/me`: `remaining` (free monthly + purchased) out of
 *              `monthly_allowance`. A query costs its tier's price; the cheapest (Standard AI
 *              Chat) is 1, so a balance under 1 can ask nothing.
 *   guest      questions — `GET /api/v1/tier/guest-me`: a count per IP for chat (10 in all, never
 *              reset, since 2026-10-09; 100 a month before) and for Investigate (0 since then: it
 *              needs an account; 5 a month before). A backend from before guest mode reopened answers only the legacy
 *              `quota_*` keys, which are read as the chat count.
 *
 * Both reset at 00:00 UTC on the 1st. The stream's `Saved` / `Error` frames carry the new
 * credit balance (`credits.remaining`), which `applyStreamCredits` folds in without a refetch.
 */
import axios from '../utils/axiosConfig';

const CREDITS_ENDPOINT = '/api/v1/credits/me';
const GUEST_ENDPOINT = '/api/v1/tier/guest-me';
const CHANGE_EVENT = 'glkb-usage-change';

// null, undefined and '' are "unknown", not zero — `Number(null)` is 0, and a `remaining: null`
// on a stream frame (which means "refetch") would otherwise read as an empty balance.
const num = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

/** The backend's UTC timestamps carry no `Z`; without it `Date` reads them as local time. */
export const parseUtc = (value) => {
    if (!value || typeof value !== 'string') return null;
    const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const parseCredits = (data) => {
    const remaining = num(data?.remaining);
    return {
        kind: 'credits',
        remaining,
        monthlyAllowance: num(data?.monthly_allowance),
        monthlyRemaining: num(data?.monthly_remaining),
        purchasedRemaining: num(data?.purchased_remaining),
        resetsAt: parseUtc(data?.resets_at),
        accountTier: data?.tier || 'free',
        limitReached: remaining !== null && remaining < 1,
    };
};

export const parseGuestUsage = (data) => {
    const chat = data?.chat || {};
    const investigate = data?.deep_research || {};
    const chatLimit = num(chat.limit) ?? num(data?.quota_limit);
    const chatRemaining = num(chat.remaining) ?? num(data?.quota_remaining);
    return {
        kind: 'guest',
        remaining: chatRemaining,
        limit: chatLimit,
        investigateRemaining: num(investigate.remaining),
        investigateLimit: num(investigate.limit),
        resetsAt: parseUtc(data?.resets_at),
        limitReached: chatRemaining !== null && chatRemaining <= 0,
    };
};

let current = null;

const publish = (usage) => {
    current = usage;
    try {
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: usage }));
    } catch (error) {
        /* no window */
    }
    return usage;
};

/** The last status read or folded in, or null before the first. */
export const getUsageSnapshot = () => current;

/** Fetch the status for this reader. Resolves to null when it cannot be read. */
export const fetchUsage = async ({ isAuthenticated }) => {
    try {
        const response = await axios.get(isAuthenticated ? CREDITS_ENDPOINT : GUEST_ENDPOINT);
        return publish(isAuthenticated ? parseCredits(response.data) : parseGuestUsage(response.data));
    } catch (error) {
        return null;
    }
};

/**
 * Fold a stream frame's `credits` (`{charged | refunded, remaining}`) into the balance. Returns
 * false when the frame had no usable figure, so the caller knows to refetch instead.
 */
export const applyStreamCredits = (credits) => {
    const remaining = num(credits?.remaining);
    if (remaining === null || current?.kind !== 'credits') return false;
    publish({ ...current, remaining, limitReached: remaining < 1 });
    return true;
};

export const subscribeToUsage = (listener) => {
    const handler = (event) => listener(event.detail);
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
};

const formatResetDate = (date) => (date
    ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
    : '');

/** The sentence shown when the reader can ask nothing more this month. */
export const limitReachedText = (usage) => {
    if (!usage) return '';
    const resets = formatResetDate(usage.resetsAt);
    if (usage.kind === 'guest') {
        const count = usage.limit ? `${usage.limit} ` : '';
        return `You've used your ${count}free questions. Sign in to keep going — it's free.`;
    }
    return resets
        ? `You're out of credits. Your free monthly credits come back on ${resets}.`
        : "You're out of credits for this month.";
};
