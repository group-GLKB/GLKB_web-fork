import {
  addFavoriteGraph,
  listFavoriteGraphs,
  removeFavoriteGraph,
} from '../service/Favorites';
import { getGraphHistoryDetail } from '../service/GraphHistory';

const STORAGE_KEY = 'glkbGraphBookmarks';

const normalizeGraph = (entry) => {
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

const normalizeGraphList = (payload) => {
    const list = Array.isArray(payload?.graphs)
        ? payload.graphs
        : (Array.isArray(payload) ? payload : []);
    return list.map(normalizeGraph).filter(Boolean);
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

export const getGraphBookmarks = () => {
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

export const setGraphBookmarks = (bookmarks) => {
    if (typeof window === 'undefined') return [];
    const next = Array.isArray(bookmarks) ? bookmarks : [];
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('glkb-graph-bookmarks-updated', { detail: next }));
    return next;
};

export const fetchGraphBookmarks = async () => {
    const data = await listFavoriteGraphs();
    const normalized = normalizeGraphList(data);
    const cached = getGraphBookmarks();
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
    return setGraphBookmarks(merged);
};

export const toggleGraphBookmark = async (entry, terms = []) => {
    if (!entry || (!entry.ghid && !entry.id)) return getGraphBookmarks();
    const bookmarks = getGraphBookmarks();
    const ghid = String(entry.ghid ?? entry.id ?? '').trim();
    if (!ghid) return bookmarks;
    const index = bookmarks.findIndex((item) => String(item.id) === ghid || String(item.ghid) === ghid);
    let next = [];

    if (index >= 0) {
        await removeFavoriteGraph(ghid);
        next = bookmarks.filter((item) => String(item.id) !== ghid && String(item.ghid) !== ghid);
    } else {
        await addFavoriteGraph(Number(ghid));
        const normalized = normalizeGraph({
            ghid: Number(ghid),
            title: entry.title || '',
            endpoint_type: entry.endpointType || entry.endpoint_type || '',
            last_accessed_time: entry.updatedAt || new Date().toISOString(),
            terms,
        }) || {
            id: String(ghid),
            ghid: Number(ghid),
            title: entry.title || '',
            endpointType: entry.endpointType || entry.endpoint_type || '',
            updatedAt: entry.updatedAt || new Date().toISOString(),
            terms,
        };
        next = [
            {
                ...normalized,
                terms: Array.isArray(terms) ? terms : [],
            },
            ...bookmarks.filter((item) => String(item.id) !== normalized.id),
        ];
    }

    setGraphBookmarks(next);
    return next;
};
