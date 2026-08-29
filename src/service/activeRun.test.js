/**
 * More than one conversation can be working at a time.
 *
 * The registry used to hold a single run, and every Agent entry point stayed locked until that
 * one finished — so a reader who thought of a new question had to wait out an answer they had
 * already stopped reading. Runs in different conversations do not race: each is its own session
 * with its own history id, and the backend locks per history id.
 *
 * What this pins is the bookkeeping the sidebar depends on — which rows show a working dot, and
 * that a finished run takes down its own mark and nobody else's.
 */
import {
    clearActiveRun,
    clearPendingRun,
    getActiveRun,
    getRunningConversationIds,
    isConversationRunning,
    isRunActive,
    setActiveRun,
    subscribeToActiveRun,
} from './activeRun';

const chatRun = (conversationId) => ({ kind: 'chat', runId: null, conversationId });

beforeEach(() => {
    clearActiveRun();
});

describe('several runs at once', () => {
    it('keeps every conversation that is working', () => {
        setActiveRun(chatRun('1'));
        setActiveRun(chatRun('2'));
        expect(getRunningConversationIds()).toEqual(new Set(['1', '2']));
        expect(isConversationRunning('1')).toBe(true);
        expect(isConversationRunning('2')).toBe(true);
        expect(isRunActive()).toBe(true);
    });

    it('takes down one mark without touching the others', () => {
        setActiveRun(chatRun('1'));
        setActiveRun(chatRun('2'));
        clearActiveRun('1');
        expect(getRunningConversationIds()).toEqual(new Set(['2']));
        expect(isRunActive()).toBe(true);
    });

    it('compares ids as strings, so a numeric history id still matches', () => {
        setActiveRun(chatRun(7));
        expect(isConversationRunning('7')).toBe(true);
        expect(isConversationRunning(7)).toBe(true);
        clearActiveRun(7);
        expect(isRunActive()).toBe(false);
    });

    it('reports the newest run to a reader that only knows about one', () => {
        setActiveRun(chatRun('1'));
        setActiveRun({ kind: 'investigate', runId: 'r-9', conversationId: '2' });
        expect(getActiveRun()).toMatchObject({ conversationId: '2', runId: 'r-9' });
    });

    it('clears everything when asked with no id — the hard reset', () => {
        setActiveRun(chatRun('1'));
        setActiveRun(chatRun('2'));
        clearActiveRun();
        expect(isRunActive()).toBe(false);
        expect(getActiveRun()).toBeNull();
    });

    it('ignores a clear for a conversation that was not running', () => {
        setActiveRun(chatRun('1'));
        clearActiveRun('nope');
        expect(getRunningConversationIds()).toEqual(new Set(['1']));
    });
});

describe('a run that starts before its conversation row exists', () => {
    it('does not appear as a conversation until it has an id', () => {
        setActiveRun(chatRun(null));
        expect(isRunActive()).toBe(true);
        expect(getRunningConversationIds()).toEqual(new Set());
    });

    it('moves onto the id the server gives it, without counting twice', () => {
        setActiveRun(chatRun(null));
        setActiveRun(chatRun('42'));
        expect(getRunningConversationIds()).toEqual(new Set(['42']));
    });

    it('keeps the time it actually started when it is re-keyed', () => {
        setActiveRun(chatRun('42'));
        const startedAt = getActiveRun().startedAt;
        setActiveRun({ ...chatRun('42'), runId: 'r-1' });
        expect(getActiveRun().startedAt).toBe(startedAt);
        expect(getActiveRun().runId).toBe('r-1');
    });

    it('can be dropped when it never got an id at all', () => {
        setActiveRun(chatRun(null));
        clearPendingRun();
        expect(isRunActive()).toBe(false);
    });

    /* Two nameless runs at once became possible when a reader could leave one answer writing
       and start another. They shared a single slot, so the second overwrote the first and
       whichever settled first took down the mark belonging to the one still going — the
       tab-close warning stopped, and every entry point reported nothing running. */
    it('keeps two nameless runs apart, by the run they belong to', () => {
        setActiveRun({ ...chatRun(null), key: 'stream-a' });
        setActiveRun({ ...chatRun(null), key: 'stream-b' });
        expect(isRunActive()).toBe(true);

        clearPendingRun('stream-a');
        expect(isRunActive()).toBe(true);          // b is still being written
        clearPendingRun('stream-b');
        expect(isRunActive()).toBe(false);
    });

    it('still hides a nameless run from the conversation list', () => {
        setActiveRun({ ...chatRun(null), key: 'stream-a' });
        expect(getRunningConversationIds()).toEqual(new Set());
    });

    it('gives up its own slot, not another run\'s, when the row arrives', () => {
        setActiveRun({ ...chatRun(null), key: 'stream-a' });
        setActiveRun({ ...chatRun(null), key: 'stream-b' });
        setActiveRun({ ...chatRun('42'), key: 'stream-a' });
        expect(getRunningConversationIds()).toEqual(new Set(['42']));
        clearPendingRun('stream-b');
        expect(getRunningConversationIds()).toEqual(new Set(['42']));
        clearActiveRun('42');
        expect(isRunActive()).toBe(false);
    });
});

describe('which run is "the" run', () => {
    // `Map.set` on an existing key keeps its original position, so without a delete first the
    // most recently touched run was not the one reported.
    it('reports the most recently written record, not the first inserted', () => {
        setActiveRun(chatRun('1'));
        setActiveRun(chatRun('2'));
        setActiveRun({ ...chatRun('1'), runId: 'r-later' });
        expect(getActiveRun()).toMatchObject({ conversationId: '1', runId: 'r-later' });
    });
});

describe('subscribers', () => {
    it('hear about every change', () => {
        const seen = [];
        const unsubscribe = subscribeToActiveRun((run) => seen.push(run?.conversationId ?? null));
        setActiveRun(chatRun('1'));
        setActiveRun(chatRun('2'));
        clearActiveRun('2');
        unsubscribe();
        setActiveRun(chatRun('3'));
        expect(seen).toEqual(['1', '2', '1']);
    });

    it('are not stopped by one of their number throwing', () => {
        const good = jest.fn();
        const unsubBad = subscribeToActiveRun(() => { throw new Error('bad listener'); });
        const unsubGood = subscribeToActiveRun(good);
        expect(() => setActiveRun(chatRun('1'))).not.toThrow();
        expect(good).toHaveBeenCalledTimes(1);
        unsubBad();
        unsubGood();
    });

    it('are not woken by a clear that changed nothing', () => {
        const listener = jest.fn();
        const unsubscribe = subscribeToActiveRun(listener);
        clearActiveRun('never-ran');
        clearActiveRun();
        expect(listener).not.toHaveBeenCalled();
        unsubscribe();
    });
});
