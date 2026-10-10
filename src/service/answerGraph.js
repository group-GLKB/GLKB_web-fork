/**
 * The knowledge graph an answer draws in its text (components/AnswerGraph).
 *
 * The agent ends an answer with `kg_query_list`, two Cypher statements over the vocabulary
 * ids the answer is about. We send the backend those ids, never the statements: the
 * endpoint is public (a guest's answer shows its graph too) and runs fixed queries on them.
 */
import axios from '../utils/axiosConfig';
import { graphFromRows, idsFromQueryList, sparsify } from '../components/AnswerGraph/answerGraph';

const ENDPOINT = '/api/v1/search/answer-graph';

// One request per id set per page load: an answer re-renders, scrolls out of a virtual list
// and back, and is shown again after a reload of the same conversation.
const cache = new Map();

export const fetchAnswerGraph = (kgQueryList) => {
    const ids = idsFromQueryList(kgQueryList);
    if (ids.length < 2) return Promise.resolve(null);
    const key = ids.join('|');
    if (!cache.has(key)) {
        const request = axios.post(ENDPOINT, { ids }, { timeout: 20000 })
            .then(({ data }) => {
                const graph = sparsify(graphFromRows(data?.rows || []));
                return graph.nodes.length >= 2 ? graph : null;
            })
            .catch((error) => {
                cache.delete(key); // a failure is retried the next time the answer is shown
                throw error;
            });
        cache.set(key, request);
    }
    return cache.get(key);
};

/** For tests. */
export const clearAnswerGraphCache = () => cache.clear();
