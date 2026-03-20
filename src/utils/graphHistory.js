import {
  createGraphHistory,
  deleteGraphHistory,
  getGraphHistoryDetail,
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

const extractTermsFromSnapshot = (snapshot) => {
    if (!Array.isArray(snapshot)) return [];
    const seen = new Set();
    return snapshot
        .map((node) => ({
            id: node?.id ?? '',
            name: node?.name || node?.label || '',
            label: node?.label || node?.name || '',
            type: node?.type || 'default',
        }))
        .filter((node) => node.name || node.label)
        .filter((node) => {
            const key = `${node.id}-${node.name}-${node.type}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
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
    const cachedById = new Map(cached.map((item) => [item.id, item]));
    const details = await Promise.allSettled(
        normalized.map((item) => getGraphHistoryDetail(item.ghid ?? item.id))
    );
    const termsById = new Map();
    details.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        const ghid = normalized[index]?.id;
        if (!ghid) return;
        const snapshot = result.value?.graph_snapshot || result.value?.graphSnapshot || [];
        termsById.set(String(ghid), extractTermsFromSnapshot(snapshot));
    });
    const merged = normalized.map((item) => {
        const terms = termsById.get(item.id);
        if (terms?.length) {
            return { ...item, terms };
        }
        const cachedItem = cachedById.get(item.id);
        return cachedItem?.terms?.length ? { ...item, terms: cachedItem.terms } : item;
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
