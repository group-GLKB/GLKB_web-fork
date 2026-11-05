/**
 * How much a reader has left to ask with.
 *
 * Two kinds of allowance since the credit system (glkb-backend docs/frontend-credits.md):
 *
 *   signed in  credits — `GET /api/v1/credits/me`: `remaining` (free monthly + purchased) out of
 *              `monthly_allowance`. A query costs its tier's price; the cheapest (Standard AI
 *              Chat) is 1, so a balance under 1 can ask nothing.
 *   guest      questions — GUEST_QUESTION_LIMIT (10) per BROWSER, in all, never reset, counted in
 *              a cookie here (since 2026-10-09; product decision: per IP shut out everyone on a
 *              shared network — a lab, a campus, a phone carrier — after the first ten). The
 *              backend keeps its own per-IP count (`GET /api/v1/tier/guest-me`); the reader is
 *              shown, and held to, the SMALLER of the two, so neither can be talked past by the
 *              other. A backend from before guest mode reopened answers only the legacy
 *              `quota_*` keys, which are read as its chat count. Investigate needs an account.
 *
 * Credits reset at 00:00 UTC on the 1st; a guest's ten never do. The stream's `Saved` / `Error`
 * frames carry the new credit balance (`credits.remaining`), which `applyStreamCredits` folds in
 * without a refetch.
 */
import axios from '../utils/axiosConfig';

const CREDITS_ENDPOINT = '/api/v1/credits/me';

/** Questions a guest may ask in this browser, in all. */
export const GUEST_QUESTION_LIMIT = 10;
const GUEST_COOKIE = 'glkb_guest_questions';
// 400 days: the longest a browser keeps a cookie (Chrome caps Max-Age there). Each question
// rewrites it, so it outlives any guest still using the site.
const GUEST_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

/** How many questions this browser has asked as a guest (the cookie; 0 when unreadable). */
export const readGuestQuestionCount = () => {
    try {
        const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${GUEST_COOKIE}=(\\d+)`));
        return match ? Math.max(0, parseInt(match[1], 10)) : 0;
    } catch (error) {
        return 0;
    }
};

const writeGuestQuestionCount = (count) => {
    try {
        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${GUEST_COOKIE}=${count}; Max-Age=${GUEST_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
    } catch (error) {
        /* cookies blocked: the backend's count still holds */
    }
};
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

/** A guest's status: this browser's count, held to the backend's when it has one (`data`). */
export const parseGuestUsage = (data) => {
    const chat = data?.chat || {};
    const investigate = data?.deep_research || {};
    const serverRemaining = num(chat.remaining) ?? num(data?.quota_remaining);
    const localRemaining = Math.max(0, GUEST_QUESTION_LIMIT - readGuestQuestionCount());
    const chatRemaining = serverRemaining === null
        ? localRemaining
        : Math.min(localRemaining, Math.max(0, serverRemaining));
    return {
        kind: 'guest',
        remaining: chatRemaining,
        limit: GUEST_QUESTION_LIMIT,
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
        // A guest's own count needs no server: it still holds them to ten.
        return isAuthenticated ? null : publish(parseGuestUsage(null));
    }
};

/**
 * One guest question answered: count it in this browser and tell whoever shows the balance.
 * Called once an AI Chat answer has arrived, so a refusal or a failed turn costs nothing.
 */
export const recordGuestQuestion = () => {
    writeGuestQuestionCount(readGuestQuestionCount() + 1);
    if (current?.kind !== 'guest') return current;
    const remaining = Math.max(0, (current.remaining ?? GUEST_QUESTION_LIMIT) - 1);
    return publish({ ...current, remaining, limitReached: remaining <= 0 });
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

/* Before a question is sent, as in Claude: a quiet line once the month's credits run low, and a
   plain notice when the balance cannot pay for the question as it is set up (mode x model),
   so the reader learns it from the composer rather than from a refused answer. Running out
   altogether (`limitReached`) keeps its own notice, `limitReachedText`, which the pages show. */

/** "Low" is at most this share of the monthly allowance left. */
export const LOW_CREDITS_SHARE = 0.2;

const PIPELINE_NOUNS = {
    chat: 'An AI Chat question',
    deep_research: 'An Investigate run',
    literature_review: 'A Literature Review',
};
const PIPELINE_NAMES = { chat: 'AI Chat', deep_research: 'Investigate', literature_review: 'Literature Review' };
/* The levels that are not their pipeline's default name themselves (service/effortLevels.js);
   Medium and Extra keep the pipeline's words, which is all there was before 2026-11-05. */
const EFFORT_NOUNS = {
    low: 'A Low-effort question',
    high: 'A High-effort question',
    max: 'A Max-effort Investigate run',
};
const EFFORT_NAMES = { low: 'Low effort', high: 'High effort', max: 'Max effort' };

const creditCount = (n) => `${n} credit${n === 1 ? '' : 's'}`;

/**
 * What the reader can still afford when the question as set up costs more than they have: the
 * most capable model on the same mode (and effort level) that fits; else AI Chat at Medium on
 * their own model (`tierId`), or the most capable chat that fits; else null. `pricing` is
 * `parsePricing`'s shape (tiers most capable first); `{ tierId, pipeline, effort, credits }`.
 * `effort` is a level other than its pipeline's default (Low, High, Max), priced from the
 * `efforts` block; '' prices the pipeline as before.
 */
export const affordableChoice = (pricing, pipeline, remaining, tierId = '', effort = '') => {
    const tiers = pricing?.tiers || [];
    const priceOn = (t, p, level) => {
        const own = level ? t.effortCredits?.[level] : undefined;
        return Number.isFinite(own) ? own : t.credits?.[p];
    };
    const fitsOn = (t, p, level = '') => Number.isFinite(priceOn(t, p, level)) && priceOn(t, p, level) <= remaining;
    const same = tiers.find((t) => fitsOn(t, pipeline, effort));
    if (same) {
        return {
            tierId: same.id, pipeline, ...(effort ? { effort } : {}), credits: priceOn(same, pipeline, effort),
        };
    }
    if (pipeline === 'chat' && !effort) return null;
    const chat = tiers.find((t) => t.id === tierId && fitsOn(t, 'chat')) || tiers.find((t) => fitsOn(t, 'chat'));
    return chat ? { tierId: chat.id, pipeline: 'chat', credits: chat.credits.chat } : null;
};

/**
 * The composer's credit notice for a signed-in reader, or null — `{ level, text, brief }`, where
 * `text` is the whole sentence (the pop-up) and `brief` the few words the floating notice shows:
 *   'short'  the question as set up costs `cost` and the balance is less — the send is held back;
 *   'low'    at most LOW_CREDITS_SHARE of the monthly allowance is left.
 * Guests (their ten questions have their own notice), an unknown balance and an empty one
 * (`limitReachedText`) get none. `labelFor(tierId)` names a model; `alternative` is
 * `affordableChoice`'s answer.
 */
export const creditNotice = (usage, {
    cost = null, pipeline = 'chat', effort = '', tierId = '', labelFor = (id) => id, alternative = null,
} = {}) => {
    if (usage?.kind !== 'credits' || usage.remaining === null || usage.remaining < 1) return null;
    const { remaining } = usage;
    const resets = formatResetDate(usage.resetsAt);
    const back = resets ? ` Your free monthly credits come back on ${resets}.` : '';
    if (Number.isFinite(cost) && remaining < cost) {
        const on = tierId ? ` on ${labelFor(tierId)}` : '';
        const noun = EFFORT_NOUNS[effort] || PIPELINE_NOUNS[pipeline] || 'This question';
        const name = EFFORT_NAMES[effort] || PIPELINE_NAMES[pipeline] || 'This question';
        let text = `${noun}${on} costs ${creditCount(cost)}`
            + ` and you have ${remaining} left.${back}`;
        if (alternative) {
            const model = labelFor(alternative.tierId);
            const sameKind = alternative.pipeline === pipeline
                && (alternative.effort || '') === (effort || '');
            // A Low or High question that does not fit falls back to Medium, which is AI Chat too.
            const altName = alternative.pipeline === pipeline ? 'Medium effort' : PIPELINE_NAMES[alternative.pipeline];
            text += sameKind
                ? ` Switch to ${model} (${creditCount(alternative.credits)}) to go ahead now.`
                : ` ${altName} on ${model} (${creditCount(alternative.credits)}) still works.`;
        }
        return {
            level: 'short',
            text,
            brief: `${name} needs ${creditCount(cost)} · ${remaining} left`,
        };
    }
    const allowance = usage.monthlyAllowance;
    if (Number.isFinite(allowance) && allowance > 0 && remaining <= allowance * LOW_CREDITS_SHARE) {
        return {
            level: 'low',
            text: `${creditCount(remaining)} left this month.${back}`,
            brief: `${creditCount(remaining)} left${resets ? ` · resets ${resets}` : ' this month'}`,
        };
    }
    return null;
};
