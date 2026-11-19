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

/**
 * A transcript without the empty answer its last question is waiting on — what an expired
 * clarify round's retry is built on. The question stays (it was asked, and the server keeps it);
 * only the placeholder of an answer that will never come goes, so the retry's own question and
 * answer follow it instead of an empty bubble.
 */
export const withoutPendingAnswer = (messages) => {
    const list = Array.isArray(messages) ? [...messages] : [];
    const last = list[list.length - 1];
    if (last?.role === 'assistant' && !String(last.content ?? '').trim()) list.pop();
    return list;
};

/**
 * What a recovery poll says about the clarify panel.
 *
 * A reader who is not on the run's stream any more — a reload, a closed tab, the "GLKB has a
 * question about your Investigate request" email opened on another device — has no
 * `clarification` frame to read. The run, paused with no timeout, waited forever for an answer
 * nobody could give, because the panel only ever came from that frame (or this tab's own
 * sessionStorage snapshot). `GET /deep-research/run` now carries the round as
 * `pending_clarification`, so the poll can put the question back up, and the answer goes through
 * the ordinary /clarify to the SAME run.
 *
 * Returns `{ action: 'show', round }` for a round the panel is not already showing (a round it
 * shows is left alone, so the reader's half-made choices are not reset every poll),
 * `{ action: 'clear' }` once the server says the run no longer waits (answered in another tab,
 * skipped, finished), and `{ action: 'keep' }` otherwise — including for a server too old to
 * send the field at all, whose silence says nothing.
 */
export const clarifyRoundFromPoll = (run, currentRound, sessionId) => {
    if (!run || typeof run !== 'object') return { action: 'keep' };
    const pending = run.pending_clarification;
    if (pending && typeof pending === 'object' && run.status === 'running') {
        const round = {
            invocationId: pending.invocation_id || null,
            stage: pending.stage || null,
            sessionId: run.session_id || sessionId || null,
            reason: pending.reason || '',
            questions: Array.isArray(pending.questions) ? pending.questions : [],
        };
        if (currentRound
            && currentRound.invocationId === round.invocationId
            && currentRound.stage === round.stage) {
            return { action: 'keep' };
        }
        return { action: 'show', round };
    }
    const knowsTheField = Object.prototype.hasOwnProperty.call(run, 'pending_clarification');
    if (currentRound && (knowsTheField || (run.status && run.status !== 'running'))) {
        return { action: 'clear' };
    }
    return { action: 'keep' };
};
