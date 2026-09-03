/**
 * Which model answers the question.
 *
 * The list is NOT written down here. The agent owns it — it is the thing that
 * actually calls OpenAI, so it is the only place that can say which ids are
 * real, what they cost and which one is the default. We fetch it once per page
 * load from `/new-llm-agent/models` and cache it in module scope; a picker that
 * hardcoded its own copy would go stale the moment a model is retired.
 *
 * `FALLBACK_MODELS` exists only so the picker still renders when that request
 * fails (offline, a backend older than this build). It is deliberately the
 * shortest defensible list rather than a mirror of the catalogue.
 *
 * The choice persists in localStorage like the notify preferences do
 * (service/notifications.js): it outlasts a session, and it is read from the
 * composer as well as from any future Settings row, so `subscribe` keeps those
 * in step across tabs.
 */
// The configured instance, not bare `axios`: it carries `baseURL` (the reorg-api prefix) and
// the auth interceptor. Bare axios would send this relative path to the web app's own origin.
import axios from '../utils/axiosConfig';

export const CHAT_MODEL_KEY = 'glkb_chat_model';

const CHANGE_EVENT = 'glkb-chat-model-change';

const CATALOG_ENDPOINT = '/api/v1/new-llm-agent/models';

/** Used only when the catalogue cannot be reached. */
export const FALLBACK_MODELS = [
    {
        id: 'gpt-5.6-terra',
        label: 'GPT-5.6 Terra',
        short_label: '5.6 Terra',
        description: 'Balanced depth and speed.',
    },
];

let catalogPromise = null;
let catalogCache = null;

/**
 * The models this deployment offers, newest-capability-first, as the agent
 * ordered them. Resolves to `{ models, default_model }`.
 *
 * One in-flight request is shared by every caller and the result is kept for
 * the life of the page: the composer, and anything else that wants to label a
 * model id, must not each cost a round trip.
 */
export const fetchModelCatalog = () => {
    if (catalogCache) return Promise.resolve(catalogCache);
    if (catalogPromise) return catalogPromise;

    catalogPromise = axios.get(CATALOG_ENDPOINT)
        .then((response) => {
            const models = Array.isArray(response?.data?.models) ? response.data.models : [];
            if (!models.length) throw new Error('empty model catalogue');
            catalogCache = {
                models,
                defaultModel: response?.data?.default_model || models[0].id,
            };
            return catalogCache;
        })
        .catch(() => {
            // Not cached: a failure here is usually transient, and the next
            // mount should get a real answer rather than this stand-in.
            catalogPromise = null;
            return { models: FALLBACK_MODELS, defaultModel: FALLBACK_MODELS[0].id };
        });

    return catalogPromise;
};

/** What the picker last showed, or '' for "whatever the server defaults to". */
export const getModelPref = () => {
    try {
        const stored = localStorage.getItem(CHAT_MODEL_KEY);
        return typeof stored === 'string' ? stored.trim() : '';
    } catch (error) {
        return '';
    }
};

/**
 * Remember a choice. Passing '' or null clears it, which is not the same as
 * storing the default id: cleared means the request carries no `model` at all,
 * so the deployment's default applies even after it changes.
 */
export const setModelPref = (modelId) => {
    const value = typeof modelId === 'string' ? modelId.trim() : '';
    try {
        if (value) {
            localStorage.setItem(CHAT_MODEL_KEY, value);
        } else {
            localStorage.removeItem(CHAT_MODEL_KEY);
        }
    } catch (error) {
        /* private mode: the choice still holds for this page's lifetime */
    }
    try {
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { model: value } }));
    } catch (error) {
        /* no window: nothing is listening anyway */
    }
};

/** Fires on our own writes and on another tab's. */
export const subscribeToModelPref = (listener) => {
    const onLocal = () => listener(getModelPref());
    const onStorage = (event) => {
        if (!event.key || event.key === CHAT_MODEL_KEY) listener(getModelPref());
    };
    window.addEventListener(CHANGE_EVENT, onLocal);
    window.addEventListener('storage', onStorage);
    return () => {
        window.removeEventListener(CHANGE_EVENT, onLocal);
        window.removeEventListener('storage', onStorage);
    };
};

/**
 * The name to print for an id, falling back to the id itself.
 *
 * `short` asks for the catalogue's abbreviated form, for a chip with no room for the full
 * one. It falls back to the full label rather than truncating: a backend older than this
 * build sends no `short_label`, and a full name that overflows still reads better than
 * "GPT-5.…".
 */
export const modelLabel = (modelId, models, { short = false } = {}) => {
    const list = Array.isArray(models) ? models : (catalogCache?.models || FALLBACK_MODELS);
    const hit = list.find((entry) => entry?.id === modelId);
    if (!hit) return modelId || '';
    return (short && hit.short_label) || hit.label || modelId || '';
};
