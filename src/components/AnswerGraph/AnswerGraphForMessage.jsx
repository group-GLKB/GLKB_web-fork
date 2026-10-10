import React, { useEffect, useRef, useState } from 'react';

import AnswerGraph from '.';
import { fetchAnswerGraph, fetchAnswerGraphForText } from '../../service/answerGraph';

const CAPTION = 'Entities this answer is about, and how GLKB connects them. Click a node or a line for details.';

/**
 * An answer's graph. From its kg_query_list when it has one; otherwise from its text, asked for
 * only once the answer is on screen (a conversation reopened from History may hold dozens of
 * answers, and each of those requests costs a model call the first time). Draws nothing until
 * there is a graph of at least two entities, and nothing at all if GLKB cannot be reached — the
 * graph is an annotation, so its absence must never look like a broken answer.
 */
export default function AnswerGraphForMessage({ kgQueryList, answer }) {
    const [graph, setGraph] = useState(null);
    const [visible, setVisible] = useState(false);
    const sentinel = useRef(null);
    const key = kgQueryList?.length ? JSON.stringify(kgQueryList) : '';

    useEffect(() => {
        if (key || visible) return undefined;
        const el = sentinel.current;
        if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return undefined; }
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) { setVisible(true); observer.disconnect(); }
        }, { rootMargin: '400px 0px' });
        observer.observe(el);
        return () => observer.disconnect();
    }, [key, visible]);

    useEffect(() => {
        let live = true;
        setGraph(null);
        const pending = key ? fetchAnswerGraph(JSON.parse(key))
            : (visible && answer ? fetchAnswerGraphForText(answer) : null);
        if (!pending) return undefined;
        pending
            .then((next) => { if (live) setGraph(next); })
            .catch(() => { /* no graph; the answer stands on its own */ });
        return () => { live = false; };
    }, [key, visible, answer]);

    if (!graph) return <span ref={sentinel} aria-hidden="true" />;
    return <AnswerGraph graph={graph} caption={CAPTION} />;
}
