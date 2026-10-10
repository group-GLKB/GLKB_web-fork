import React, { useEffect, useState } from 'react';

import AnswerGraph from '.';
import { fetchAnswerGraph } from '../../service/answerGraph';

const CAPTION = 'Entities this answer is about, and how GLKB connects them. Click a node or a line for details.';

/**
 * An answer's graph, fetched from its kg_query_list. Draws nothing until there is a graph
 * of at least two entities, and nothing at all if GLKB cannot be reached — the graph is an
 * annotation, so its absence must never look like a broken answer.
 */
export default function AnswerGraphForMessage({ kgQueryList }) {
    const [graph, setGraph] = useState(null);
    const key = kgQueryList?.length ? JSON.stringify(kgQueryList) : '';

    useEffect(() => {
        let live = true;
        setGraph(null);
        if (!key) return undefined;
        fetchAnswerGraph(JSON.parse(key))
            .then((next) => { if (live) setGraph(next); })
            .catch(() => { /* no graph; the answer stands on its own */ });
        return () => { live = false; };
    }, [key]);

    if (!graph) return null;
    return <AnswerGraph graph={graph} caption={CAPTION} />;
}
