/**
 * How hard GLKB works on a question — the composer's "Effort" (design: GLKB Effort A, 2026-10-27).
 *
 * One chat, adjustable depth: the reader picks an effort for each question instead of choosing
 * between AI Chat and Investigate. Two of the five levels run today, each on a pipeline that
 * already existed:
 *
 *   medium -> the chat agent (GLKBAgent)            pipeline 'chat'
 *   extra  -> deep research (GLKBHarness)           pipeline 'deep_research' (was "Investigate")
 *
 * Low, High and Max are listed, greyed out, until a pipeline backs them. The design's "Auto" is
 * left out by decision.
 *
 * The choice persists in localStorage and `subscribeToEffortPref` keeps the home composer and the
 * chat's in step, as `serviceTiers.js` does for the model.
 */
import { INVESTIGATE_ENABLED } from '../config/features';

export const EFFORT_KEY = 'glkb_effort';
const CHANGE_EVENT = 'glkb-effort-change';

export const EFFORT_MEDIUM = 'medium';
export const EFFORT_EXTRA = 'extra';
export const DEFAULT_EFFORT = EFFORT_MEDIUM;

/** In the order the menu lists them. `time` is what a run typically takes. */
export const EFFORT_LEVELS = [
    { id: 'low', label: 'Low', description: 'Fast, straightforward answers', time: 'Seconds' },
    { id: 'medium', label: 'Medium', description: 'Balanced speed and depth', time: '~30 s' },
    { id: 'high', label: 'High', description: 'In-depth scientific reasoning', time: '1–2 min' },
    { id: 'extra', label: 'Extra', description: 'Comprehensive multi-step analysis', time: '3–5 min' },
    { id: 'max', label: 'Max', description: 'Most thorough analysis', time: '8–15 min', warn: true },
];

/** The levels a question can be sent at. Extra exists only where Investigate does (read at call
 * time, not load time, so the flag can be switched in tests). */
export const enabledEfforts = () => [EFFORT_MEDIUM, ...(INVESTIGATE_ENABLED ? [EFFORT_EXTRA] : [])];

export const isEffortEnabled = (id) => enabledEfforts().includes(id);

/** Levels that run deep research: they need an account and do not read attached files. */
export const isDeepEffort = (id) => id === EFFORT_EXTRA || id === 'max';

export const effortLevel = (id) => EFFORT_LEVELS.find((level) => level.id === id) || null;

export const effortLabel = (id) => effortLevel(id)?.label || '';

/** The pipeline (and price list) a question at this effort runs on. */
export const effortPipeline = (id) => (isDeepEffort(id) ? 'deep_research' : 'chat');

/** An effort that can be sent: the stored one if it still runs, else the default. */
export const normalizeEffort = (id) => {
    const value = typeof id === 'string' ? id.trim().toLowerCase() : '';
    return isEffortEnabled(value) ? value : DEFAULT_EFFORT;
};

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

/** Fires on our own writes and on another tab's. */
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
