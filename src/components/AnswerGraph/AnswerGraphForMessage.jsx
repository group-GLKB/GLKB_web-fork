import React, { useEffect, useRef, useState } from 'react';

import AnswerGraph from '.';
import AnswerGraphV2 from './AnswerGraphV2';
import { normalizeAnswerGraph, wantsAnswerGraphV2 } from './answerGraphV2Data';
import { fetchAnswerGraph, fetchAnswerGraphForText, fetchAnswerGraphV2 } from '../../service/answerGraph';

const CAPTION = 'Entities this answer is about, and how GLKB connects them. Click a node or a line for details.';
const CAPTION_V2 = 'What this answer says, as a graph. Click a line for its sentence, papers and GLKB support.';

/* The Complete frame lands a moment before Saved, which brings the answer's row id the request
   needs: wait that long for it rather than draw the basic graph and swap it out. */
const SAVE_GRACE_MS = 4000;
/* "Building the knowledge graph…" only once the build is visibly taking time. A backend without
   the endpoint (dev, until it is deployed) answers its 404 well inside this, so the reader sees
   the basic graph arrive exactly as before and nothing else. */
const PLACEHOLDER_DELAY_MS = 900;

/**
 * An answer's graph.
 *
 * At High, Extra and Max in a saved conversation, the ANSWER graph: what the answer says, built
 * once by the backend after the answer (`fetchAnswerGraphV2`), with a quiet line while it is built.
 * Anything else — Low or Medium, a guest, an unsaved answer, `basic: true`, a null graph, any
 * failure — gets the BASIC graph, exactly as before: from its kg_query_list when it has one,
 * otherwise from its text, asked for only once the answer is on screen (a conversation reopened
 * from History may hold dozens of answers, and each of those requests costs a model call the
 * first time). `basic` false means this answer had no basic graph to fall back to (its turn did
 * not ask for one), so a failed answer graph draws nothing. Draws nothing until there is a graph
 * of at least two entities, and nothing at all if GLKB cannot be reached — the graph is an
 * annotation, so its absence must never look like a broken answer.
 */
export default function AnswerGraphForMessage({
    kgQueryList, answer, effort = '', historyId = null, invocationId = null, messageId = null,
    isGuest = false, references = null, basic = true,
}) {
    const [graph, setGraph] = useState(null);
    const [visible, setVisible] = useState(false);
    const sentinel = useRef(null);
    const key = kgQueryList?.length ? JSON.stringify(kgQueryList) : '';

    const wantsV2 = wantsAnswerGraphV2({ effort, isGuest, historyId });
    // 'waiting' for the invocation id, 'loading', 'ready' (v2 drawn) or 'basic'.
    const [v2, setV2] = useState(() => ({ status: wantsV2 ? 'waiting' : 'basic', graph: null }));
    const [slow, setSlow] = useState(false);
    const basicActive = v2.status === 'basic' && basic;

    useEffect(() => {
        if (visible) return undefined;
        // The basic graph from a list needs no visibility; everything else waits for it.
        if (key && !wantsV2) return undefined;
        const el = sentinel.current;
        if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return undefined; }
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) { setVisible(true); observer.disconnect(); }
        }, { rootMargin: '400px 0px' });
        observer.observe(el);
        return () => observer.disconnect();
    }, [key, visible, wantsV2]);

    /* The answer graph: wait for Saved's address — the answer's row (`messageId`; an Investigate
       answer has nothing else) or its invocation id — then ask once the answer is on screen. */
    const rowId = Number.isFinite(Number(messageId)) && Number(messageId) > 0 ? Number(messageId) : null;
    useEffect(() => {
        if (!wantsV2) { setV2({ status: 'basic', graph: null }); return undefined; }
        if (!rowId && !invocationId) {
            setV2({ status: 'waiting', graph: null });
            const timer = setTimeout(() => setV2({ status: 'basic', graph: null }), SAVE_GRACE_MS);
            return () => clearTimeout(timer);
        }
        if (!visible) { setV2({ status: 'waiting', graph: null }); return undefined; }
        let live = true;
        setV2({ status: 'loading', graph: null });
        fetchAnswerGraphV2({ historyId, invocationId, messageId: rowId }).then((result) => {
            if (!live) return;
            const shaped = result?.basic ? null : normalizeAnswerGraph(result?.graph);
            setV2(shaped ? { status: 'ready', graph: shaped } : { status: 'basic', graph: null });
        });
        return () => { live = false; };
    }, [wantsV2, historyId, invocationId, rowId, visible]);

    useEffect(() => {
        setSlow(false);
        if (v2.status !== 'loading') return undefined;
        const timer = setTimeout(() => setSlow(true), PLACEHOLDER_DELAY_MS);
        return () => clearTimeout(timer);
    }, [v2.status]);

    // The basic graph, once the answer graph is out of the picture.
    useEffect(() => {
        let live = true;
        setGraph(null);
        if (!basicActive) return undefined;
        const pending = key ? fetchAnswerGraph(JSON.parse(key))
            : (visible && answer ? fetchAnswerGraphForText(answer) : null);
        if (!pending) return undefined;
        pending
            .then((next) => { if (live) setGraph(next); })
            .catch(() => { /* no graph; the answer stands on its own */ });
        return () => { live = false; };
    }, [key, visible, answer, basicActive]);

    if (v2.status === 'ready' && v2.graph) {
        return <AnswerGraphV2 graph={v2.graph} caption={CAPTION_V2} references={references} />;
    }
    if (v2.status === 'loading' && slow) {
        return <div className="ag-building" role="status" ref={sentinel}>Building the knowledge graph…</div>;
    }
    if (!graph || !basicActive) return <span ref={sentinel} aria-hidden="true" />;
    return <AnswerGraph graph={graph} caption={CAPTION} />;
}
