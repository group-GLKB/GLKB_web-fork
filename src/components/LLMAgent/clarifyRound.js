/**
 * Resolving which clarify round a Submit/Skip click is answering.
 *
 * Its own module, with no imports: `components/LLMAgent/index.jsx` cannot be pulled into a test
 * without dragging the whole app in behind it.
 */

/**
 * Work out the (session_id, invocation_id, stage) triple to POST to /clarify.
 *
 * `refRound` is the copy written by the SSE handler the instant the clarification frame lands;
 * `stateRound` is the React state the panel rendered from. They should be identical — the ref
 * exists because issue #12 captured a HAR where the identifiers were plainly on the wire and Skip
 * still reported "Clarification session has expired" having sent ZERO clarify requests, i.e. the
 * click handler read them as null. The ref wins so the answer cannot be a render behind.
 *
 * `liveSessionId` is `sessionIdRef.current`: a round's frame does not carry session_id (only the
 * `Started` frame does), so the round's own copy was itself resolved from this same source.
 *
 * Returns `{ ok }` false when the round cannot be addressed. That is NOT "expired" — nothing timed
 * out; there is simply no address to reply to.
 */
export const resolveClarifyRound = (refRound, stateRound, liveSessionId) => {
    const round = refRound || stateRound || null;
    const sessionId = round?.sessionId || liveSessionId || null;
    const invocationId = round?.invocationId || null;
    const stage = round?.stage || null;
    return {
        round,
        sessionId,
        invocationId,
        stage,
        questions: Array.isArray(round?.questions) ? round.questions : [],
        ok: Boolean(sessionId && invocationId && stage),
    };
};
