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
