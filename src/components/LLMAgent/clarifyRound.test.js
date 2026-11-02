/**
 * Which clarify round a Submit/Skip click answers.
 *
 * Issue #12: a HAR showed `Started` carrying session_id and the clarification frame carrying
 * invocation_id + stage, and Skip still reported "Clarification session has expired" while sending
 * ZERO clarify requests. The identifiers were on the wire; the click handler read them as null.
 *
 * Re-verified against the live agent on 2026-07-31 across four paths (new conversation, follow-up
 * turn, client-supplied session id, and the mid_research round): every clarification frame carried
 * invocation_id + stage, and POST /clarify answered `{"ok":true,"resolved":true}` each time. So the
 * loss is on the client, which is what the ref-first rule below exists to prevent.
 */
import { clarifyRoundFromPoll, resolveClarifyRound } from './clarifyRound';

const round = (over = {}) => ({
    invocationId: 'inv-1',
    stage: 'pre_retrieval',
    sessionId: 'stream_abc',
    questions: [{ header: 'Scope' }],
    ...over,
});

describe('resolveClarifyRound', () => {
    it('answers the round the stream actually delivered', () => {
        const r = resolveClarifyRound(round(), round(), 'stream_abc');
        expect(r.ok).toBe(true);
        expect(r).toMatchObject({ invocationId: 'inv-1', stage: 'pre_retrieval', sessionId: 'stream_abc' });
    });

    it('prefers the ref when React state is a render behind', () => {
        // The exact issue-#12 shape: the panel is showing a round the click handler cannot see.
        const r = resolveClarifyRound(round({ invocationId: 'fresh' }), null, 'stream_abc');
        expect(r.ok).toBe(true);
        expect(r.invocationId).toBe('fresh');
    });

    it('prefers the ref when the two disagree', () => {
        const r = resolveClarifyRound(round({ invocationId: 'fresh' }), round({ invocationId: 'stale' }), 's');
        expect(r.invocationId).toBe('fresh');
    });

    it('falls back to state when the ref is empty', () => {
        const r = resolveClarifyRound(null, round(), 'stream_abc');
        expect(r.ok).toBe(true);
        expect(r.invocationId).toBe('inv-1');
    });

    it('falls back to the live session id, since a clarification frame carries none', () => {
        // Only the `Started` frame has session_id; the round's own copy came from there too.
        const r = resolveClarifyRound(round({ sessionId: null }), null, 'stream_live');
        expect(r.ok).toBe(true);
        expect(r.sessionId).toBe('stream_live');
    });

    it('is not ok when there is no round at all', () => {
        expect(resolveClarifyRound(null, null, 'stream_abc').ok).toBe(false);
    });

    it.each(['invocationId', 'stage', 'sessionId'])('is not ok without %s', (field) => {
        const r = resolveClarifyRound(round({ [field]: null }), null, null);
        expect(r.ok).toBe(false);
    });

    it('always hands back an array of questions', () => {
        // buildClarifyAnswers maps over this; a non-array would throw inside the click handler.
        expect(resolveClarifyRound(round({ questions: undefined }), null, 's').questions).toEqual([]);
        expect(resolveClarifyRound(null, null, null).questions).toEqual([]);
    });
});


describe('clarifyRoundFromPoll', () => {
    const pending = {
        invocation_id: 'inv-1',
        stage: 'pre_retrieval',
        reason: 'ambiguous',
        question: 'EGFR?',
        questions: [{ header: 'Cancer', question: 'Which cancer?' }],
    };
    const paused = { run_id: 'r1', session_id: 'stream_abc', status: 'running', pending_clarification: pending };

    it('puts a paused run\'s question back up for a reader with no stream', () => {
        const d = clarifyRoundFromPoll(paused, null, 'other');
        expect(d.action).toBe('show');
        expect(d.round).toEqual({
            invocationId: 'inv-1',
            stage: 'pre_retrieval',
            sessionId: 'stream_abc',
            reason: 'ambiguous',
            questions: pending.questions,
        });
        // ...and the round it yields is one Submit can address.
        expect(resolveClarifyRound(d.round, null, null).ok).toBe(true);
    });

    it('falls back to the conversation\'s session id when the run omits one', () => {
        const d = clarifyRoundFromPoll({ ...paused, session_id: null }, null, 'stream_conv');
        expect(d.round.sessionId).toBe('stream_conv');
    });

    it('leaves a round already on screen alone, so drafts survive the next poll', () => {
        expect(clarifyRoundFromPoll(paused, round(), 'stream_abc').action).toBe('keep');
    });

    it('replaces a different round (the mid-research one after the first)', () => {
        const d = clarifyRoundFromPoll(
            { ...paused, pending_clarification: { ...pending, stage: 'mid_research' } },
            round(), 'stream_abc',
        );
        expect(d.action).toBe('show');
        expect(d.round.stage).toBe('mid_research');
    });

    it('clears the panel once the server says the run no longer waits', () => {
        expect(clarifyRoundFromPoll({ ...paused, pending_clarification: null }, round(), 's').action).toBe('clear');
        expect(clarifyRoundFromPoll({ run_id: 'r1', status: 'complete' }, round(), 's').action).toBe('clear');
    });

    it('says nothing when an older server does not send the field', () => {
        expect(clarifyRoundFromPoll({ run_id: 'r1', status: 'running' }, round(), 's').action).toBe('keep');
        expect(clarifyRoundFromPoll(null, round(), 's').action).toBe('keep');
        expect(clarifyRoundFromPoll({ ...paused, pending_clarification: null }, null, 's').action).toBe('keep');
    });
});
