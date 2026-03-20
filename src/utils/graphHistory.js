import {
    createGraphHistory,
    deleteGraphHistory,
    listGraphHistories,
} from '../service/GraphHistory';

const STORAGE_KEY = 'glkbGraphHistories';

const sortGraphHistories = (list) => (
    [...list].sort((a, b) => new Date(b?.updatedAt || 0) - new Date(a?.updatedAt || 0))
);

const normalizeGraphSummary = (entry) => {
    if (!entry) return null;
    const ghid = entry.ghid ?? entry.id ?? null;
    if (!ghid) return null;
    return {
        id: String(ghid),
        ghid,
        title: entry.title || '',
        endpointType: entry.endpoint_type || entry.endpointType || '',
        createdAt: entry.created_at || entry.createdAt || null,
        updatedAt: entry.last_accessed_time || entry.updatedAt || entry.created_at || entry.createdAt || null,
        terms: Array.isArray(entry.terms) ? entry.terms : [],
    };
};

const normalizeGraphSummaryList = (payload) => {
    const list = Array.isArray(payload?.histories)
        ? payload.histories
        : (Array.isArray(payload) ? payload : []);
    return list.map(normalizeGraphSummary).filter(Boolean);
};

export const getGraphHistories = () => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
};

export const setGraphHistories = (histories) => {
    if (typeof window === 'undefined') return [];
    const next = sortGraphHistories(Array.isArray(histories) ? histories : []);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('glkb-graph-histories-updated', { detail: next }));
    return next;
};

export const fetchGraphHistories = async (options = {}) => {
    const data = await listGraphHistories(options);
    const normalized = normalizeGraphSummaryList(data);
    const cached = getGraphHistories();
    if (cached.length === 0) {
        return setGraphHistories(normalized);
    }
    const cachedById = new Map(cached.map((item) => [item.id, item]));
    const merged = normalized.map((item) => {
        const cachedItem = cachedById.get(item.id);
        if (!cachedItem?.terms?.length) return item;
        return {
            ...item,
            terms: cachedItem.terms,
        };
    });
    return setGraphHistories(merged);
};

export const createGraphHistoryEntry = async ({ title = '', endpointType = '', graphSnapshot = [], terms = [] } = {}) => {
    const payload = {
        title,
        endpoint_type: endpointType,
        graph_snapshot: graphSnapshot,
    };
    const data = await createGraphHistory(payload);
    const normalized = normalizeGraphSummary(data);
    if (!normalized) {
        return getGraphHistories();
    }
    const nextEntry = {
        ...normalized,
        terms: Array.isArray(terms) ? terms : [],
    };
    const next = [nextEntry, ...getGraphHistories().filter((item) => item.id !== normalized.id)];
    setGraphHistories(next);
    return nextEntry;
};

export const removeGraphHistory = async (ghid) => {
    if (!ghid) return null;
    const result = await deleteGraphHistory(ghid);
    const next = getGraphHistories().filter((item) => String(item.id) !== String(ghid));
    setGraphHistories(next);
    return result;
};
