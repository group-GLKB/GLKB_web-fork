import axios from 'axios';

/**
 * Bibliographic records for PubMed articles — the CSL-JSON NCBI publishes for each one,
 * proxied and cached by the backend (`GET /api/v1/citation`). The dialog and the exports
 * render every style from this record; see `components/Units/CiteDialog/format.js`.
 *
 * Records never change, so a fetched one is kept for the life of the page and a lookup
 * already in flight is shared rather than repeated.
 */
const CITATION_BASE_URL = '/api/v1/citation';
const MAX_BATCH = 50;

const records = new Map();   // pmid → csl
const inFlight = new Map();  // pmid → Promise<csl | null>

export const isPmid = (value) => /^[1-9]\d{0,8}$/.test(String(value ?? '').trim());

/** The CSL record for one article, or null when NCBI has none (or the backend is unreachable). */
export const fetchCitation = async (pmid) => {
    const id = String(pmid ?? '').trim();
    if (!isPmid(id)) return null;
    if (records.has(id)) return records.get(id);
    if (inFlight.has(id)) return inFlight.get(id);
    const request = axios.get(`${CITATION_BASE_URL}/${id}`)
        .then((response) => {
            const csl = response?.data?.csl || null;
            if (csl) records.set(id, csl);
            return csl;
        })
        .catch(() => null)
        .finally(() => inFlight.delete(id));
    inFlight.set(id, request);
    return request;
};

/** Records for many articles at once: `{ [pmid]: csl }`, omitting any NCBI has no record for. */
export const fetchCitations = async (pmids) => {
    const ids = [...new Set((pmids || []).map((p) => String(p ?? '').trim()).filter(isPmid))];
    const found = {};
    const missing = [];
    ids.forEach((id) => {
        if (records.has(id)) found[id] = records.get(id);
        else missing.push(id);
    });
    for (let start = 0; start < missing.length; start += MAX_BATCH) {
        const batch = missing.slice(start, start + MAX_BATCH);
        try {
            // eslint-disable-next-line no-await-in-loop
            const response = await axios.get(CITATION_BASE_URL, { params: { pmids: batch.join(',') } });
            Object.entries(response?.data?.items || {}).forEach(([id, csl]) => {
                if (csl) {
                    records.set(id, csl);
                    found[id] = csl;
                }
            });
        } catch {
            // A failed batch leaves its ids absent; callers fall back to their own metadata.
        }
    }
    return found;
};

/** The exporter's RIS text for one article, or null. */
export const fetchRis = async (pmid) => {
    const id = String(pmid ?? '').trim();
    if (!isPmid(id)) return null;
    try {
        const response = await axios.get(`${CITATION_BASE_URL}/${id}`, {
            params: { format: 'ris' },
            responseType: 'text',
            transformResponse: [(data) => data],
        });
        return typeof response?.data === 'string' && response.data.includes('TY  - ') ? response.data : null;
    } catch {
        return null;
    }
};

/** For tests. */
export const clearCitationCache = () => {
    records.clear();
    inFlight.clear();
};
