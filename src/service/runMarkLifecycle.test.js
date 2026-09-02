/**
 * A conversation can always be asked in again.
 *
 * The registry gates whether a question is SENT or QUEUED: `submitOrQueue` calls
 * `isConversationRunning`, and `nextReleasableEntry` skips any conversation that says yes.
 * So a mark that cannot be taken down is not a cosmetic problem — it is a conversation the
 * reader can type into forever without anything leaving the box.
 *
 * Making the registry durable introduced exactly that risk, from three directions: a record
 * read back from disk had no live owner to clear it; `is_answering` came back true from a
 * server that had lost the run; and `setActiveRun` quietly dropped the flag that said which
 * marks were safe to reconcile away. These pin all three shut.
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

describe('a mark read back from disk can be put down', () => {
    it('forgetRun takes it out of memory and off the disk', () => {
        markRunInFlight({ conversationId: '7', sessionId: 'web_seven' });
        const activeRun = freshModules();
        expect(activeRun.isConversationRunning('7')).toBe(true);

        activeRun.forgetRun('7');

        expect(activeRun.isConversationRunning('7')).toBe(false);
        expect(freshModules().isConversationRunning('7')).toBe(false);
    });

    it('and the next list refresh does not put it straight back', () => {
        /* The server's word is bounded but not instant: a run it has lost still reports
           `is_answering` until the age bound catches up. A client that has just polled the
           run itself and found it gone knows sooner, and its answer has to stick — otherwise
           the conversation was unaskable for the life of the tab. */
        markRunInFlight({ conversationId: '7', sessionId: 'web_seven' });
        const activeRun = freshModules();

        activeRun.forgetRun('7');
        activeRun.reconcileRunsWithServer([{ id: '7', isAnswering: true, sessionId: 'web_seven' }]);

        expect(activeRun.isConversationRunning('7')).toBe(false);
    });

    it('but a genuinely new run in it is live again', () => {
        const activeRun = freshModules();
        activeRun.forgetRun('7');

        activeRun.setActiveRun({ kind: 'chat', conversationId: '7', sessionId: 'web_new' });

        expect(activeRun.isConversationRunning('7')).toBe(true);
        // …and the server's word counts again from here.
        activeRun.reconcileRunsWithServer([{ id: '7', isAnswering: true }]);
        expect(activeRun.isConversationRunning('7')).toBe(true);
    });

    it('forgetting one conversation leaves the others alone', () => {
        markRunInFlight({ conversationId: '1', sessionId: 'a' });
        markRunInFlight({ conversationId: '2', sessionId: 'b' });
        const activeRun = freshModules();

        activeRun.forgetRun('1');

        expect(activeRun.isConversationRunning('1')).toBe(false);
        expect(activeRun.isConversationRunning('2')).toBe(true);
    });
});

describe('who owns a mark', () => {
    it('a live run owns its own, and reconciliation may not take it', () => {
        /* The `saved` frame refreshes the conversation list a moment before the stream
           finishes settling, so the server says "done" while the run is still writing. */
        const activeRun = freshModules();
        activeRun.setActiveRun({ kind: 'chat', conversationId: '7', sessionId: 'web_seven' });

        activeRun.reconcileRunsWithServer([{ id: '7', isAnswering: false }]);

        expect(activeRun.isConversationRunning('7')).toBe(true);
    });

    it('a reattach that registers over a recovered mark takes ownership of it', () => {
        /* `setActiveRun` used to drop the `recovered` flag implicitly through the spread, so
           a resumed conversation's mark looked live to reconciliation and could never be
           taken down again. It has to come off deliberately — the caller that registers is
           the caller that will clear. */
        markRunInFlight({ conversationId: '7', sessionId: 'web_seven' });
        const activeRun = freshModules();
        activeRun.setActiveRun({
            kind: 'chat', conversationId: '7', sessionId: 'web_seven', key: 'resume:7',
        });

        activeRun.clearActiveRun('7');

        expect(activeRun.isConversationRunning('7')).toBe(false);
        expect(freshModules().isConversationRunning('7')).toBe(false);
    });

    it('a mark the server put up is still the server\'s to take down', () => {
        const activeRun = freshModules();
        activeRun.reconcileRunsWithServer([{ id: '8', isAnswering: true, sessionId: 'web_eight' }]);
        expect(activeRun.isConversationRunning('8')).toBe(true);

        activeRun.reconcileRunsWithServer([{ id: '8', isAnswering: false }]);

        expect(activeRun.isConversationRunning('8')).toBe(false);
    });
});
