import {
    ACTIVE_RUN_SNAPSHOT_KEY,
    LEGACY_SNAPSHOT_KEY,
    clearActiveRunSnapshot,
    releaseGuestSlot,
    readActiveRunSnapshot,
    readActiveRunSnapshotFor,
    readAllActiveRunSnapshots,
    shouldResumeAgentInBackground,
    writeActiveRunSnapshot,
} from './agentRunSnapshot';

beforeEach(() => {
    sessionStorage.clear();
});

/** The stored shape is a map now; this is how a test plants one entry in it. */
const plant = (slot, snapshot) => {
    sessionStorage.setItem(ACTIVE_RUN_SNAPSHOT_KEY, JSON.stringify({ [slot]: snapshot }));
};

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
        plant('42', {
            version: 1,
            active: true,
            conversationId: '42',
            savedAt: Date.now() - (25 * 60 * 60 * 1000),
        });
        expect(readActiveRunSnapshot()).toBeNull();

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
        plant('42', {
            version: 1, active: true, conversationId: '42', savedAt: Date.now(),
        });
        expect(readActiveRunSnapshot()).toBeNull();
    });

    it('does not share a slot with a signed-in reader\'s conversation', () => {
        writeActiveRunSnapshot({ conversationId: null, messages });
        writeActiveRunSnapshot({ conversationId: '7', messages });
        expect(readActiveRunSnapshotFor(null).conversationId).toBeNull();
        expect(readActiveRunSnapshotFor('7').conversationId).toBe('7');
    });
});

/**
 * A reader can leave one answer writing and start another. The single slot this replaced was
 * overwritten by whichever run held the foreground, and cleared when the foreground moved —
 * so the run still going lost its partial answer and its progress, and coming back to it
 * showed a bare question with nothing behind it.
 */
describe('more than one run at a time', () => {
    const snapshotFor = (id, step) => ({
        conversationId: id,
        sessionId: `web_${id}`,
        streamingStepName: step,
        messages: [{ role: 'user', content: `question ${id}` }],
    });

    it('keeps one snapshot per conversation', () => {
        writeActiveRunSnapshot(snapshotFor('1', 'Searching'));
        writeActiveRunSnapshot(snapshotFor('2', 'Screening papers'));

        expect(readActiveRunSnapshotFor('1').streamingStepName).toBe('Searching');
        expect(readActiveRunSnapshotFor('2').streamingStepName).toBe('Screening papers');
        expect(readAllActiveRunSnapshots()).toHaveLength(2);
    });

    it('clearing one leaves the others alone', () => {
        writeActiveRunSnapshot(snapshotFor('1', 'Searching'));
        writeActiveRunSnapshot(snapshotFor('2', 'Screening papers'));

        clearActiveRunSnapshot('2');

        expect(readActiveRunSnapshotFor('2')).toBeNull();
        expect(readActiveRunSnapshotFor('1').streamingStepName).toBe('Searching');
    });

    it('clearing one that was never stored is harmless', () => {
        writeActiveRunSnapshot(snapshotFor('1', 'Searching'));
        clearActiveRunSnapshot('nope');
        expect(readActiveRunSnapshotFor('1')).not.toBeNull();
    });

    it('offers the newest when asked without a conversation', () => {
        writeActiveRunSnapshot(snapshotFor('1', 'Searching'));
        writeActiveRunSnapshot(snapshotFor('2', 'Screening papers'));
        expect(readActiveRunSnapshot().conversationId).toBe('2');
    });

    it('drops the oldest rather than growing without limit', () => {
        for (let i = 1; i <= 9; i += 1) writeActiveRunSnapshot(snapshotFor(String(i), 'x'));
        const kept = readAllActiveRunSnapshots().map((s) => s.conversationId);
        expect(kept).toHaveLength(6);
        expect(kept).not.toContain('1');
        expect(kept).toContain('9');
    });
});

describe('the single slot this replaced', () => {
    it('is read once, so a reload across the upgrade still finds its run', () => {
        sessionStorage.setItem(LEGACY_SNAPSHOT_KEY, JSON.stringify({
            version: 2,
            active: true,
            conversationId: '42',
            sessionId: 'web_old',
            savedAt: Date.now(),
        }));

        expect(readActiveRunSnapshotFor('42')).toEqual(expect.objectContaining({
            conversationId: '42', sessionId: 'web_old',
        }));
        // …and retired, so it cannot come back later over a newer snapshot.
        expect(sessionStorage.getItem(LEGACY_SNAPSHOT_KEY)).toBeNull();
    });

    it('is discarded when it was already stale', () => {
        sessionStorage.setItem(LEGACY_SNAPSHOT_KEY, JSON.stringify({
            version: 2, active: true, conversationId: '42', savedAt: 0,
        }));
        expect(readActiveRunSnapshot()).toBeNull();
    });
});


/**
 * The migration has to SURVIVE being read.
 *
 * It used to remove the old key and write the new one only `if (pruned)` — which is false on
 * a fresh upgrade, when there is nothing stale to prune. So the migrated run was handed to
 * whichever caller read first and then existed nowhere. `PersistentAgentSurface` calls
 * `shouldResumeAgentInBackground()` during render and keeps only the boolean, so on any
 * non-chat page that first reader threw the run away before the chat component ever asked.
 */
describe('the migration persists', () => {
    const legacy = () => ({
        version: 2,
        active: true,
        conversationId: '42',
        sessionId: 'web_old',
        savedAt: Date.now(),
    });

    it('survives a reader that only wants the boolean', () => {
        sessionStorage.setItem(LEGACY_SNAPSHOT_KEY, JSON.stringify(legacy()));

        expect(shouldResumeAgentInBackground()).toBe(true);   // the first, discarding reader

        expect(readActiveRunSnapshotFor('42')).toEqual(expect.objectContaining({
            conversationId: '42', sessionId: 'web_old',
        }));
    });

    it('is written under the new key before the old one is dropped', () => {
        sessionStorage.setItem(LEGACY_SNAPSHOT_KEY, JSON.stringify(legacy()));
        readActiveRunSnapshot();
        expect(sessionStorage.getItem(ACTIVE_RUN_SNAPSHOT_KEY)).toContain('web_old');
        expect(sessionStorage.getItem(LEGACY_SNAPSHOT_KEY)).toBeNull();
    });

    it('does not resurrect a stale legacy record', () => {
        sessionStorage.setItem(LEGACY_SNAPSHOT_KEY, JSON.stringify({
            ...legacy(), savedAt: 0,
        }));
        expect(readActiveRunSnapshot()).toBeNull();
        expect(sessionStorage.getItem(LEGACY_SNAPSHOT_KEY)).toBeNull();
    });
});

/**
 * A signed-in run has no conversation for the length of the `createConversation` round trip,
 * so it writes into the same slot a guest uses. That interim copy has to be handed back when
 * the id arrives — otherwise it lingers as the newest snapshot in the store and a later mount
 * restores a stranger's transcript from it.
 */
describe('the no-conversation slot', () => {
    it('is released when the run acquires an id', () => {
        writeActiveRunSnapshot({
            conversationId: null,
            messages: [{ role: 'user', content: 'asked before the row existed' }],
        });
        writeActiveRunSnapshot({
            conversationId: '9',
            messages: [{ role: 'user', content: 'asked before the row existed' }],
        });

        releaseGuestSlot();

        expect(readActiveRunSnapshotFor(null)).toBeNull();
        expect(readActiveRunSnapshotFor('9')).not.toBeNull();
        expect(readActiveRunSnapshot().conversationId).toBe('9');
    });

    it('releasing it when empty is harmless', () => {
        writeActiveRunSnapshot({ conversationId: '9', messages: [{ role: 'user', content: 'x' }] });
        releaseGuestSlot();
        expect(readActiveRunSnapshotFor('9')).not.toBeNull();
    });
});
