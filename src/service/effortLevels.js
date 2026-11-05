/**
 * How hard GLKB works on a question — the composer's "Effort" (design: GLKB Effort A, 2026-10-27).
 *
 * One chat, adjustable depth: the reader picks an effort for each question instead of choosing
 * between AI Chat and Investigate. Five levels, each on one of the two pipelines (the three-repo
 * effort contract, 2026-11-05):
 *
 *   low    -> the chat agent (GLKBAgent)            pipeline 'chat'
 *   medium -> the chat agent, as it always ran      pipeline 'chat'           (chat's default)
 *   high   -> the chat agent, working longer        pipeline 'chat'           (signed-in only)
 *   extra  -> deep research (GLKBHarness)           pipeline 'deep_research'  (was "Investigate")
 *   max    -> deep research, the whole pass         pipeline 'deep_research'
 *
 * WHICH levels a question can be sent at is the backend's to say: `GET /credits/pricing` lists
 * them in an `efforts` block (fetched with the tiers, service/serviceTiers.js, and handed here by
 * `setServerEfforts`). A backend without the block knows only Medium and Extra, so that is all
 * that is offered — exactly the menu before 2026-11-05. Low, High and Max are in addition held
 * off glkb.org (`isProductionSite`) until the owner opens them there; on dev and localhost they
 * follow the block. Levels not offered stay listed, greyed out.
 *
 * The DEFAULT level of each pipeline (Medium, Extra) is never put on the wire (`effortForRequest`),
 * so a backend or agent that predates efforts sees exactly the request it always did.
 *
 * The choice persists in localStorage and `subscribeToEffortPref` keeps the home composer and the
 * chat's in step, as `serviceTiers.js` does for the model.
 */
import { INVESTIGATE_ENABLED, isProductionSite } from '../config/features';

export const EFFORT_KEY = 'glkb_effort';
const CHANGE_EVENT = 'glkb-effort-change';

export const EFFORT_LOW = 'low';
export const EFFORT_MEDIUM = 'medium';
export const EFFORT_HIGH = 'high';
export const EFFORT_EXTRA = 'extra';
export const EFFORT_MAX = 'max';
export const DEFAULT_EFFORT = EFFORT_MEDIUM;

/** Each pipeline's default level: what a request that names none runs at. */
export const DEFAULT_EFFORT_BY_PIPELINE = { chat: EFFORT_MEDIUM, deep_research: EFFORT_EXTRA };

/** In the order the menu lists them. `time` is what a run typically takes. */
export const EFFORT_LEVELS = [
    { id: 'low', label: 'Low', description: 'Fast, straightforward answers', time: '~15 s' },
    { id: 'medium', label: 'Medium', description: 'Balanced speed and depth', time: '~30 s' },
    { id: 'high', label: 'High', description: 'In-depth scientific reasoning', time: '1–2 min' },
    { id: 'extra', label: 'Extra', description: 'Comprehensive multi-step analysis', time: '5–8 min' },
    { id: 'max', label: 'Max', description: 'Most thorough analysis', time: '10–20 min', warn: true },
];
const EFFORT_IDS = EFFORT_LEVELS.map((level) => level.id);

export const isEffortId = (id) => EFFORT_IDS.includes(id);

/** An effort id as sent or stored anywhere ('High ', null, 'quick'), or '' when it is not one. */
export const effortOf = (value) => {
    const id = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return isEffortId(id) ? id : '';
};

/** Levels that run deep research: they need an account and do not read attached files. */
export const isDeepEffort = (id) => id === EFFORT_EXTRA || id === EFFORT_MAX;

/** The pipeline (and price list) a question at this effort runs on. */
export const effortPipeline = (id) => (isDeepEffort(id) ? 'deep_research' : 'chat');

export const isDefaultEffort = (id) => id === EFFORT_MEDIUM || id === EFFORT_EXTRA;

/* ---- what the backend offers (GET /credits/pricing `efforts`) ---- */

/* null = the backend sent no `efforts` block (or the pricing has not arrived yet): Medium and
   Extra only. Otherwise `[{ id, pipeline, enabled, guest, default, prices }]` in menu order. */
let serverEfforts = null;

/**
 * The pricing's `efforts` block, as `parseEfforts` in serviceTiers.js shapes it, or null when it
 * has none. Tells every composer to re-read its level: a stored High that could not be offered
 * before the block arrived can be now.
 */
export const setServerEfforts = (rows) => {
    const next = Array.isArray(rows) && rows.length ? rows : null;
    const same = JSON.stringify(next) === JSON.stringify(serverEfforts);
    serverEfforts = next;
    if (same) return;
    try {
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { source: 'pricing' } }));
    } catch (error) {
        /* no window: nothing is listening anyway */
    }
};

/** For tests. */
export const getServerEfforts = () => serverEfforts;

const serverRow = (id) => (serverEfforts || []).find((row) => row.id === id) || null;

/**
 * The levels a question can be sent at, read at call time (the flags can be switched in tests and
 * the block arrives after load):
 *   no block           Medium, and Extra where Investigate is on — the menu before 2026-11-05;
 *   a block            the levels it marks enabled, Extra and Max only where Investigate is on,
 *                      and Low, High and Max only off glkb.org.
 */
export const enabledEfforts = () => {
    if (!serverEfforts) return [EFFORT_MEDIUM, ...(INVESTIGATE_ENABLED ? [EFFORT_EXTRA] : [])];
    const production = isProductionSite();
    return EFFORT_IDS.filter((id) => {
        if (!serverRow(id)?.enabled) return false;
        if (isDeepEffort(id) && !INVESTIGATE_ENABLED) return false;
        if (!isDefaultEffort(id) && production) return false;
        return true;
    });
};

export const isEffortEnabled = (id) => enabledEfforts().includes(id);

/** Whether more than the two original levels are on offer — the multi-level menu is live. */
export const effortsExpanded = () => enabledEfforts().some((id) => !isDefaultEffort(id));

/**
 * Whether a guest has to sign in for this level. Deep research always needs an account; beyond
 * that, whatever the block marks `guest: false` (High, as of 2026-11-05).
 */
export const isGuestLockedEffort = (id) => isDeepEffort(id) || serverRow(id)?.guest === false;

export const effortLevel = (id) => EFFORT_LEVELS.find((level) => level.id === id) || null;

export const effortLabel = (id) => effortLevel(id)?.label || '';

/** An effort that can be sent: the stored one if it still runs, else the default. */
export const normalizeEffort = (id) => {
    const value = effortOf(id);
    return isEffortEnabled(value) ? value : DEFAULT_EFFORT;
};

/**
 * The level a turn runs at, given the pipeline it was resolved to. The composer's level when it
 * belongs to that pipeline; otherwise (a queued entry from before efforts, a regenerate of an
 * answer that never recorded one) the pipeline's default.
 */
export const effortForTurn = (effort, investigate) => {
    const pipeline = investigate ? 'deep_research' : 'chat';
    const id = effortOf(effort);
    return id && effortPipeline(id) === pipeline ? id : DEFAULT_EFFORT_BY_PIPELINE[pipeline];
};

/**
 * What a request carries as `effort`: the level only when it is not its pipeline's default and
 * belongs to that pipeline, else undefined (the field is left off). So every Medium and Extra
 * question is byte-for-byte the request it was before efforts existed.
 */
export const effortForRequest = (effort, investigate) => {
    const id = effortForTurn(effort, investigate);
    return isDefaultEffort(id) ? undefined : id;
};

/**
 * The level a message was asked at: its own `effort` (recorded at submit, or the server's
 * `ChatMessageResponse.effort` on reload), else — an answer from before efforts — Extra for an
 * Investigate one and Medium for any other.
 */
export const messageEffort = (message) => (
    effortOf(message?.effort) || (message?.investigateMode ? EFFORT_EXTRA : EFFORT_MEDIUM)
);

export const getEffortPref = () => {
    try {
        return normalizeEffort(localStorage.getItem(EFFORT_KEY));
    } catch (error) {
        return DEFAULT_EFFORT;
    }
};

export const setEffortPref = (id) => {
    const value = normalizeEffort(id);
    try {
        localStorage.setItem(EFFORT_KEY, value);
    } catch (error) {
        /* private mode: the choice still holds for this page's lifetime */
    }
    try {
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { effort: value } }));
    } catch (error) {
        /* no window: nothing is listening anyway */
    }
};

/** Fires on our own writes, on another tab's, and when the backend's levels arrive. */
export const subscribeToEffortPref = (listener) => {
    const onLocal = () => listener(getEffortPref());
    const onStorage = (event) => {
        if (!event.key || event.key === EFFORT_KEY) listener(getEffortPref());
    };
    window.addEventListener(CHANGE_EVENT, onLocal);
    window.addEventListener('storage', onStorage);
    return () => {
        window.removeEventListener(CHANGE_EVENT, onLocal);
        window.removeEventListener('storage', onStorage);
    };
};
