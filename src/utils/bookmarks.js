import {
  addFavoriteReference,
  listFavoriteReferences,
  removeFavoriteReference,
} from '../service/Favorites';

const STORAGE_KEY = 'glkbBookmarks';

const normalizeReference = (entry) => {
    if (!entry) return null;
    const ref = entry.ref_json || entry;
    const pmid = ref?.pmid || entry?.pmid || '';
    if (!pmid && !ref?.url) return null;
    const authors = Array.isArray(ref?.authors)
        ? ref.authors.join(', ')
        : (ref?.authors || 'Authors not available');
    return {
        id: String(pmid || ref?.url || ''),
        pmid: pmid ? String(pmid) : '',
        title: ref?.title || '',
        url: ref?.url || '',
        citation_count: ref?.n_citation ?? ref?.citation_count ?? 0,
        year: ref?.date ?? ref?.year ?? '',
        journal: ref?.journal || '',
        authors,
        evidence: Array.isArray(ref?.evidence) ? ref.evidence : [],
        source_hid: entry?.source_hid ?? ref?.source_hid ?? null,
        created_at: entry?.created_at || null,
        ref_json: ref,
    };
};

const normalizeReferenceList = (payload) => {
    const list = Array.isArray(payload?.references)
        ? payload.references
        : (Array.isArray(payload) ? payload : []);
    return list.map(normalizeReference).filter(Boolean);
};

const buildRefJson = (entry) => {
    if (!entry) return null;
    if (entry.ref_json) return entry.ref_json;
    const pmid = entry.pmid || entry.id || '';
    return {
        pmid: String(pmid || ''),
        title: entry.title || '',
        url: entry.url || '',
        n_citation: entry.citation_count ?? entry.n_citation ?? 0,
        date: entry.year ?? entry.date ?? '',
        journal: entry.journal || '',
        authors: Array.isArray(entry.authors)
            ? entry.authors
            : (entry.authors ? entry.authors.split(', ').filter(Boolean) : []),
        evidence: Array.isArray(entry.evidence) ? entry.evidence : [],
    };
};

export const getBookmarks = () => {
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

export const setBookmarks = (bookmarks) => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    window.dispatchEvent(new CustomEvent('glkb-bookmarks-updated', { detail: bookmarks }));
};

export const fetchBookmarks = async () => {
    const data = await listFavoriteReferences();
    const normalized = normalizeReferenceList(data);
    setBookmarks(normalized);
    return normalized;
};

export const toggleBookmark = async (entry, options = {}) => {
    if (!entry || (!entry.id && !entry.pmid)) return getBookmarks();
    const bookmarks = getBookmarks();
    const pmid = String(entry.pmid || entry.id || '').trim();
    if (!pmid) return bookmarks;
    const index = bookmarks.findIndex((item) => String(item.id) === pmid || String(item.pmid) === pmid);
    let next = [];

    if (index >= 0) {
        await removeFavoriteReference(pmid);
        next = bookmarks.filter((item) => String(item.id) !== pmid && String(item.pmid) !== pmid);
    } else {
        const refJson = buildRefJson(entry);
        const response = await addFavoriteReference(pmid, refJson, options.sourceHid ?? entry.source_hid ?? null);
        const normalized = normalizeReference(response) || normalizeReference({ pmid, ref_json: refJson });
        next = [normalized, ...bookmarks.filter((item) => String(item.id) !== normalized.id)];
    }

    setBookmarks(next);
    return next;
};
