/**
 * The knowledge graph an answer draws in its text (components/AnswerGraph).
 *
 * The agent ends an answer with `kg_query_list`, two Cypher statements over the vocabulary ids the
 * answer is about. We send the backend those ids, never the statements: the endpoint is public (a
 * guest's answer shows its graph too) and runs fixed queries on them.
 *
 * An answer can also come without a list — the agent drops it rather than make the answer late,
 * and answers saved before the list existed have none. For those we send the answer's text and
 * the backend has the agent find its entities first (cached per text, limited per client).
 */
import axios from '../utils/axiosConfig';
import { graphFromRows, idsFromQueryList, sparsify } from '../components/AnswerGraph/answerGraph';

const ENDPOINT = '/api/v1/search/answer-graph';

// One request per answer per page load: an answer re-renders, scrolls out of a virtual list and
// back, and is shown again after a reload of the same conversation.
const cache = new Map();

const request = (key, body) => {
    if (!cache.has(key)) {
        const pending = axios.post(ENDPOINT, body, { timeout: 40000 })
            .then(({ data }) => {
                const graph = sparsify(graphFromRows(data?.rows || []));
                return graph.nodes.length >= 2 ? graph : null;
            })
            .catch((error) => {
                cache.delete(key); // a failure is retried the next time the answer is shown
                throw error;
            });
        cache.set(key, pending);
    }
    return cache.get(key);
};

export const fetchAnswerGraph = (kgQueryList) => {
    const ids = idsFromQueryList(kgQueryList);
    if (ids.length < 2) return Promise.resolve(null);
    return request(`ids:${ids.join('|')}`, { ids });
};

/** For an answer with no list: its text, without the citation sidecar the agent appends. */
export const fetchAnswerGraphForText = (answer) => {
    const text = String(answer || '').split(/\n#{1,3}\s*Citations\s*\n/i)[0].trim();
    if (text.length < 200) return Promise.resolve(null);
    return request(`text:${text.length}:${text.slice(0, 200)}:${text.slice(-200)}`, { answer: text.slice(0, 20000) });
};

/** For tests. */
export const clearAnswerGraphCache = () => cache.clear();
