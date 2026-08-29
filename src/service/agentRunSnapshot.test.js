import {
    ACTIVE_RUN_SNAPSHOT_KEY,
    clearActiveRunSnapshot,
    readActiveRunSnapshot,
    shouldResumeAgentInBackground,
    writeActiveRunSnapshot,
} from './agentRunSnapshot';

beforeEach(() => {
    sessionStorage.clear();
});

describe('active Agent run snapshots', () => {
    it('round-trips the live progress needed after a reconnect', () => {
        expect(writeActiveRunSnapshot({
            conversationId: 42,
            sessionId: 'session-1',
            runId: 'run-1',
            investigate: true,
            streamingStepName: 'Screening papers',
            investigatePercent: 48,
        })).toBe(true);

        expect(readActiveRunSnapshot()).toEqual(expect.objectContaining({
            active: true,
            conversationId: '42',
            sessionId: 'session-1',
            runId: 'run-1',
            streamingStepName: 'Screening papers',
            investigatePercent: 48,
        }));
        expect(shouldResumeAgentInBackground()).toBe(true);
    });

    it('supports older in-flight sessions that only wrote the processing flag', () => {
        sessionStorage.setItem('llmWasProcessing', 'true');
        expect(shouldResumeAgentInBackground()).toBe(true);
    });

    it('rejects stale or malformed snapshots', () => {
        sessionStorage.setItem(ACTIVE_RUN_SNAPSHOT_KEY, JSON.stringify({
            version: 1,
            active: true,
            conversationId: '42',
            savedAt: Date.now() - (25 * 60 * 60 * 1000),
        }));
        expect(readActiveRunSnapshot()).toBeNull();
        expect(sessionStorage.getItem(ACTIVE_RUN_SNAPSHOT_KEY)).toBeNull();

        sessionStorage.setItem(ACTIVE_RUN_SNAPSHOT_KEY, '{broken');
        expect(readActiveRunSnapshot()).toBeNull();
    });

    it('can be cleared after the run settles', () => {
        writeActiveRunSnapshot({ conversationId: '42' });
        clearActiveRunSnapshot();
        expect(readActiveRunSnapshot()).toBeNull();
    });
});

/**
 * A signed-out reader has no conversation row — `createConversation` is behind
 * `isAuthenticated` — so both gates here used to refuse the snapshot outright and a refresh
 * mid-answer lost the question and the answer with it. Guests have their own quota and are a
 * supported class of user; their work has to survive a reload like anyone else's.
 */
describe('a run with no conversation of its own', () => {
    const messages = [
        { role: 'user', content: 'what is BRCA1?' },
        { role: 'assistant', content: 'BRCA1 is…' },
    ];

    it('is kept, on the strength of the messages it carries', () => {
        expect(writeActiveRunSnapshot({ conversationId: null, messages })).toBe(true);
        expect(readActiveRunSnapshot()).toEqual(expect.objectContaining({
            active: true, conversationId: null, messages,
        }));
    });

    it('restores the question, not just the answer', () => {
        writeActiveRunSnapshot({ conversationId: null, messages });
        expect(readActiveRunSnapshot().messages[0]).toEqual(
            { role: 'user', content: 'what is BRCA1?' },
        );
    });

    it('is refused when it describes nothing that could be put back', () => {
        expect(writeActiveRunSnapshot({ conversationId: null })).toBe(false);
        expect(writeActiveRunSnapshot({ conversationId: null, messages: [] })).toBe(false);
        expect(readActiveRunSnapshot()).toBeNull();
    });

    it('still prefers a conversation id when there is one', () => {
        writeActiveRunSnapshot({ conversationId: 7, messages });
        expect(readActiveRunSnapshot().conversationId).toBe('7');
    });

    it('discards a v1 snapshot rather than half-reading it', () => {
        sessionStorage.setItem(ACTIVE_RUN_SNAPSHOT_KEY, JSON.stringify({
            version: 1, active: true, conversationId: '42', savedAt: Date.now(),
        }));
        expect(readActiveRunSnapshot()).toBeNull();
    });
});
