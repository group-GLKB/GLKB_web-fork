/**
 * A follow-up is the same follow-up after the run it belongs to is saved.
 *
 * Reported: with a follow-up queued in one conversation, switching to another, asking there,
 * and then moving between the two added a pending bubble on every switch — and eventually
 * sent the same follow-up several times.
 *
 * The queue's anti-replay ledger keyed an entry on [conversationId, runKey, id], and two of
 * those three are rewritten while the entry waits: the Saved frame files a nameless entry
 * under its new conversation id. A follow-up that had already been sent therefore came back
 * under a name nothing recognised — not this ledger, not the snapshot removal, not the
 * de-duplication in the view — so it was drawn again, and sent again.
 */
import {
    ACTIVE_RUN_SNAPSHOT_KEY,
    consumeQueuedPrompt,
    unconsumeQueuedPrompt,
    pendingQueuedPrompts,
    queueEntryIdentity,
    readActiveRunSnapshotFor,
    removeQueuedPromptFromSnapshot,
    writeActiveRunSnapshot,
} from './agentRunSnapshot';

// The shape ids have had since they were made globally unique.
const uniqueId = (n) => `q-1758040000000-${n}-ab12cd`;

beforeEach(() => {
    sessionStorage.clear();
});

describe('what a queued follow-up is known by', () => {
    it('does not change when the Saved frame files it under a conversation', () => {
        const queued = { id: uniqueId(1), conversationId: null, runKey: 'stream-7', text: 'Why?' };
        const claimed = { ...queued, conversationId: '42', runKey: null };

        expect(queueEntryIdentity(claimed)).toBe(queueEntryIdentity(queued));
    });

    it('still tells two legacy q-N entries in different conversations apart', () => {
        // `q-1` was only unique inside one mount, so two snapshots can each hold one.
        const mine = { id: 'q-1', conversationId: 'a' };
        const theirs = { id: 'q-1', conversationId: 'b' };

        expect(queueEntryIdentity(mine)).not.toBe(queueEntryIdentity(theirs));
    });
});

describe('a follow-up that has been sent', () => {
    it('stays sent after it is claimed onto its conversation', () => {
        const queued = { id: uniqueId(1), conversationId: null, runKey: 'stream-7', text: 'Why?' };
        consumeQueuedPrompt(queued);

        const claimed = { ...queued, conversationId: '42', runKey: null };

        expect(pendingQueuedPrompts([claimed])).toEqual([]);
    });

    it('is removed from every slot it was filed in, not just its newest one', () => {
        const entry = { id: uniqueId(2), conversationId: null, runKey: 'stream-7', text: 'Why?' };
        // It was written under the nameless slot, then claimed onto conversation 42 and
        // written there too — both copies are restorable until both are removed.
        writeActiveRunSnapshot({ conversationId: null, queuedPrompts: [entry] });
        writeActiveRunSnapshot({
            conversationId: '42',
            queuedPrompts: [{ ...entry, conversationId: '42', runKey: null }],
        });

        removeQueuedPromptFromSnapshot('42', entry.id);

        const stored = JSON.parse(sessionStorage.getItem(ACTIVE_RUN_SNAPSHOT_KEY));
        const everyQueue = Object.values(stored).flatMap((snap) => snap.queuedPrompts || []);
        expect(everyQueue).toEqual([]);
    });

    it('leaves a legacy q-N in the other conversation alone', () => {
        const mine = { id: 'q-1', conversationId: 'a', text: 'Mine' };
        const theirs = { id: 'q-1', conversationId: 'b', text: 'Theirs' };
        writeActiveRunSnapshot({ conversationId: 'a', queuedPrompts: [mine] });
        writeActiveRunSnapshot({ conversationId: 'b', queuedPrompts: [theirs] });

        removeQueuedPromptFromSnapshot('a', 'q-1');

        expect(readActiveRunSnapshotFor('a').queuedPrompts).toEqual([]);
        expect(readActiveRunSnapshotFor('b').queuedPrompts).toEqual([theirs]);
    });

    it('is not drawn twice when both copies survive in one restore', () => {
        const queued = { id: uniqueId(3), conversationId: null, runKey: 'stream-7', text: 'Why?' };
        const claimed = { ...queued, conversationId: '42', runKey: null };

        expect(pendingQueuedPrompts([queued, claimed])).toEqual([queued]);
    });
});


describe('a follow-up that was taken out of the queue but never sent', () => {
    it('can be put back, and is pending again', () => {
        // It leaves the queue BEFORE the submit, so a conversation switch cannot send it
        // twice. When the submit then refuses — over quota, auth still loading — the entry
        // must not simply cease to exist.
        const entry = { id: uniqueId(9), conversationId: '42', text: 'Why?' };
        consumeQueuedPrompt(entry);
        expect(pendingQueuedPrompts([entry])).toEqual([]);

        unconsumeQueuedPrompt(entry);

        expect(pendingQueuedPrompts([entry])).toEqual([entry]);
    });

    it('leaves the other follow-ups\' records alone', () => {
        const sent = { id: uniqueId(10), conversationId: '42', text: 'Sent' };
        const refused = { id: uniqueId(11), conversationId: '42', text: 'Refused' };
        consumeQueuedPrompt(sent);
        consumeQueuedPrompt(refused);

        unconsumeQueuedPrompt(refused);

        expect(pendingQueuedPrompts([sent, refused])).toEqual([refused]);
    });

    it('is harmless for an entry that was never consumed', () => {
        const entry = { id: uniqueId(12), conversationId: '42', text: 'Never sent' };
        unconsumeQueuedPrompt(entry);
        expect(pendingQueuedPrompts([entry])).toEqual([entry]);
    });
});
