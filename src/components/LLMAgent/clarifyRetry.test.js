/**
 * The retry of an Investigate clarify round whose run is gone.
 *
 * POST /clarify answers `{ resolved: false, retry_question }` when no run is waiting for the
 * round any more — the agent's process restarted, or the answer reached another worker — but the
 * round was on disk, so the answers were applied to it and the question to ask again comes back.
 * The agent's contract is to re-ask it on the SAME session (glkb-agent
 * docs/DEEP_RESEARCH_HANDOFF.md §6).
 *
 * The retry used to start on a new, empty agent session (`resetInvestigateSession`, 2026-07), so
 * every later follow-up in the conversation lost its history: the deep-research harness reads a
 * follow-up's prior turns from the session, and the conversation's stored session id was moved to
 * the new, empty one. It also never ran at all while the run that asked was still on screen —
 * that run's conversation was still marked as answering, which refuses a second turn.
 *
 * Pinned here: the retry keeps the conversation's session, still leaves the expired round and
 * its run behind, lets go of that run before starting, and replaces only its empty answer.
 * The flow lives inside a component of several thousand lines with a live stream behind it, so
 * the glue is asserted in the source, as composerMode.wiring.test.js does.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { withoutPendingAnswer } from './clarifyRound';

const source = readFileSync(join(__dirname, 'index.jsx'), 'utf-8');
const between = (start, end) => {
    const from = source.indexOf(start);
    expect(from).toBeGreaterThan(-1);
    return source.slice(from, source.indexOf(end, from));
};
const retryBranch = () => between('if (retryQuestion) {', '} else {\n                    message.info(');
const submit = () => between('const handleSubmit = async (e, input = null, t = null, options = {}) => {', 'const updateClarificationDraft');

describe('the transcript the retry is built on', () => {
    it('keeps the question and drops only the answer that will never come', () => {
        const asked = [
            { role: 'user', content: 'first' },
            { role: 'assistant', content: 'answer' },
            { role: 'user', content: 'and in mice?' },
            { role: 'assistant', content: '', investigateMode: true },
        ];
        expect(withoutPendingAnswer(asked)).toEqual(asked.slice(0, 3));
        // An answer that has text is not a placeholder.
        expect(withoutPendingAnswer(asked.slice(0, 2))).toEqual(asked.slice(0, 2));
        expect(withoutPendingAnswer(asked.slice(0, 3))).toEqual(asked.slice(0, 3));
        expect(withoutPendingAnswer(null)).toEqual([]);
        // The input is not changed.
        expect(asked).toHaveLength(4);
    });
});

describe('the retry of an expired clarify round', () => {
    it('no longer asks for a new session', () => {
        expect(source).not.toMatch(/resetInvestigateSession\s*:/);
        expect(source).not.toContain('setStoredSessionId(historyId, null)');
        expect(retryBranch()).toContain('clarifyRetry: { sessionId: sessionId || null },');
    });

    it("runs on the conversation's own session, and leaves the expired run's id behind", () => {
        const block = between('if (clarifyRetry) {\n            sessionIdRef.current', '        // An investigate run must know');
        expect(block).toContain(
            'sessionIdRef.current = getStoredSessionId(historyId) || clarifyRetry.sessionId || sessionIdRef.current;',
        );
        expect(block).toContain('runIdRef.current = null;');
        // ...and that session is the one the conversation keeps for its next follow-ups.
        expect(submit()).toMatch(/if \(historyId\) \{\s*setStoredSessionId\(historyId, sessionIdRef\.current\);/);
    });

    it('still starts with no trace of the expired round', () => {
        // Cleared for every turn this view starts, the retry included.
        expect(submit()).toMatch(/applyPendingClarification\(null\);\s*setClarificationDrafts\(\{\}\);/);
    });

    it('lets go of the run that asked first — on this side only — and waits for it to settle', () => {
        const branch = retryBranch();
        expect(branch).toContain('if (abortControllerRef.current) abortControllerRef.current.abort();');
        expect(branch).not.toContain('cancelRun');
        const wait = branch.indexOf('await expiredRunSettled;');
        expect(wait).toBeGreaterThan(-1);
        expect(branch.indexOf('stableSubmit(')).toBeGreaterThan(wait);
        // A reattached view has no request to settle: its mark goes instead.
        expect(branch).toMatch(/else if \(conversationId != null\) \{\s*forgetRun\(String\(conversationId\)\);/);
    });

    it('replaces only the empty answer, in the same conversation, on the same terms', () => {
        const branch = retryBranch();
        expect(branch).toContain('baseHistory: withoutPendingAnswer(transcript),');
        expect(branch).toContain('conversationId,');
        expect(branch).toContain('serviceTier: prior.serviceTier,');
        expect(branch).toContain('investigateEnabled: true,');
    });

    it('settles every submitted run, and marks the retry as answering itself', () => {
        const body = submit();
        expect(body).toContain('runSettledRef.current.set(streamId, new Promise((resolve) => { markRunSettled = resolve; }));');
        expect(body).toMatch(/runSettledRef\.current\.delete\(streamId\);\s*markRunSettled\(\);\s*\}/);
        expect(body).toMatch(/if \(clarifyRetry && !shouldStartNewConversation && targetConversationId != null\) \{\s*setActiveRun\(\{\s*kind: 'investigate',/);
    });
});
