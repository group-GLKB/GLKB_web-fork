/**
 * A run that is still being answered survives the page that started it.
 *
 * The registry is module state, so a reload emptied it — and then everything that reads it
 * said "nothing is running here". The sidebar lost its working dots. The restore stopped
 * preferring a conversation's locally stored turn over the server's shorter copy, which is the
 * only record of a question the server has not saved yet. And the guard that keeps a second
 * turn off a busy history id went quiet on exactly the runs it exists to protect.
 *
 * The registry now reads itself back from a durable record on load, and settles it against the
 * server's `is_answering` on every list refresh — which also picks up a run started in another
 * window, or on another device.
 */
import { markRunInFlight } from './runRecovery';

const freshModules = () => {
    let mod;
    jest.isolateModules(() => {
        // eslint-disable-next-line global-require
        mod = require('./activeRun');
    });
    return mod;
};

beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
});

describe('a reload picks the registry up where it left off', () => {
    it('remembers the conversations that were being answered', () => {
        markRunInFlight({ conversationId: '7', sessionId: 'web_seven' });
        markRunInFlight({ conversationId: '9', sessionId: 'web_nine', kind: 'investigate' });

        // A new module registry is what a reload gives the app.
        const activeRun = freshModules();

        expect(activeRun.getRunningConversationIds()).toEqual(new Set(['7', '9']));
        expect(activeRun.isConversationRunning('7')).toBe(true);
    });

    it('brings back the address each one can be collected at', () => {
        markRunInFlight({ conversationId: '7', sessionId: 'web_seven' });
        const activeRun = freshModules();
        expect(activeRun.getRunSessionId('7')).toBe('web_seven');
        expect(activeRun.getRunSessionId('nope')).toBeNull();
    });

    it('starts empty when nothing was in flight', () => {
        const activeRun = freshModules();
        expect(activeRun.getRunningConversationIds()).toEqual(new Set());
        expect(activeRun.isRunActive()).toBe(false);
    });
});

describe('a run records itself as it starts', () => {
    it('writes the durable record, so the next load knows about it', () => {
        const activeRun = freshModules();
        activeRun.setActiveRun({
            kind: 'chat',
            runId: null,
            conversationId: '3',
            sessionId: 'web_three',
        });

        const reloaded = freshModules();
        expect(reloaded.isConversationRunning('3')).toBe(true);
        expect(reloaded.getRunSessionId('3')).toBe('web_three');
    });

    it('takes the record down when the run settles', () => {
        const activeRun = freshModules();
        activeRun.setActiveRun({ kind: 'chat', conversationId: '3', sessionId: 'web_three' });
        activeRun.clearActiveRun('3');

        expect(freshModules().isConversationRunning('3')).toBe(false);
    });

    it('records nothing for a run that has no conversation yet', () => {
        const activeRun = freshModules();
        activeRun.setActiveRun({ kind: 'chat', conversationId: null, key: 'stream-1' });
        expect(freshModules().getRunningConversationIds()).toEqual(new Set());
    });
});

describe('settling the registry against the server', () => {
    it('drops a recovered mark whose run the server has since finished', () => {
        markRunInFlight({ conversationId: '7', sessionId: 'web_seven' });
        const activeRun = freshModules();
        expect(activeRun.isConversationRunning('7')).toBe(true);

        activeRun.reconcileRunsWithServer([{ id: '7', isAnswering: false }]);

        expect(activeRun.isConversationRunning('7')).toBe(false);
        expect(freshModules().isConversationRunning('7')).toBe(false);
    });

    it('leaves a mark a live request in this tab put up', () => {
        /* The `saved` frame refreshes the list a moment before the stream finishes settling,
           so the server says "done" while the local run is still writing. Clearing here would
           free the conversation and let a queued follow-up race its own predecessor. */
        const activeRun = freshModules();
        activeRun.setActiveRun({ kind: 'chat', conversationId: '7', sessionId: 'web_seven' });

        activeRun.reconcileRunsWithServer([{ id: '7', isAnswering: false }]);

        expect(activeRun.isConversationRunning('7')).toBe(true);
    });

    it('picks up a run this tab never saw', () => {
        // Asked in another window, or on another device.
        const activeRun = freshModules();
        activeRun.reconcileRunsWithServer([
            { id: '8', isAnswering: true, sessionId: 'web_eight', isInvestigate: true },
        ]);

        expect(activeRun.isConversationRunning('8')).toBe(true);
        expect(activeRun.getRunSessionId('8')).toBe('web_eight');
        expect(freshModules().getRunSessionId('8')).toBe('web_eight');
    });

    it('tops up an address that arrives later without disturbing the mark', () => {
        markRunInFlight({ conversationId: '7', sessionId: null });
        const activeRun = freshModules();
        expect(activeRun.getRunSessionId('7')).toBeNull();

        activeRun.reconcileRunsWithServer([{ id: '7', isAnswering: true, sessionId: 'web_seven' }]);

        expect(activeRun.getRunSessionId('7')).toBe('web_seven');
        expect(activeRun.isConversationRunning('7')).toBe(true);
    });

    it('tells its listeners when something changed', () => {
        const activeRun = freshModules();
        const listener = jest.fn();
        activeRun.subscribeToActiveRun(listener);

        activeRun.reconcileRunsWithServer([{ id: '8', isAnswering: true }]);
        expect(listener).toHaveBeenCalled();

        listener.mockClear();
        activeRun.reconcileRunsWithServer([{ id: '8', isAnswering: true }]);
        expect(listener).not.toHaveBeenCalled();
    });

    it('ignores a list that is not one', () => {
        const activeRun = freshModules();
        expect(() => activeRun.reconcileRunsWithServer(null)).not.toThrow();
        expect(() => activeRun.reconcileRunsWithServer([null, {}])).not.toThrow();
    });
});
