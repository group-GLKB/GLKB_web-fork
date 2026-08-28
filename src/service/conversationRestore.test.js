/**
 * Asking a question must not make the question disappear.
 *
 * The restore blanks the message list while it fetches — `isConversationLoading` takes
 * `renderMessages()` off the page — so the cases below are the difference between watching an
 * answer arrive and staring at "Loading chat history... This may take ~20 seconds" with the
 * question you just asked hidden behind it.
 *
 * The regression these pin: asking a question creates the conversation row, selecting it
 * upgrades /chat to /chat/<public_id>, and `routePublicId` is a dependency of the restore
 * effect — so the rename re-ran the restore with an address that looked authoritative, and it
 * reloaded the conversation that was mid-stream.
 */
import { shouldSkipConversationRestore } from './conversationRestore';

const STREAM = '1756370000000-ab12cd';

describe('the address bar catching up with a live run', () => {
    it('stands back when the URL names the conversation being written', () => {
        expect(shouldSkipConversationRestore({
            routeConversationId: '42',
            activeConversationId: '42',
            runningConversationId: '42',
            activeStreamId: STREAM,
        })).toBe(true);
    });

    it('stands back when only the RUN knows the id — the reader is looking elsewhere', () => {
        // handleSubmit keeps a historical conversation selected if the reader opened one while
        // the row was being created; the new row still owns the run.
        expect(shouldSkipConversationRestore({
            routeConversationId: '42',
            activeConversationId: null,
            runningConversationId: '42',
            activeStreamId: STREAM,
        })).toBe(true);
    });

    it('compares ids as strings, so a numeric row id still matches', () => {
        expect(shouldSkipConversationRestore({
            routeConversationId: 42,
            activeConversationId: '42',
            activeStreamId: STREAM,
        })).toBe(true);
    });
});

describe('an address the reader actually asked for', () => {
    it('loads a DIFFERENT conversation even while a run is in flight', () => {
        expect(shouldSkipConversationRestore({
            routeConversationId: '7',
            activeConversationId: '42',
            runningConversationId: '42',
            activeStreamId: STREAM,
        })).toBe(false);
    });

    it('loads on a cold open of the same id — a reload or a pasted link', () => {
        // Nothing is streaming here, and sessionStorage did not survive the tab closing, so
        // the page really is empty and really does need fetching.
        expect(shouldSkipConversationRestore({
            routeConversationId: '42',
            activeConversationId: '42',
            runningConversationId: '42',
            activeStreamId: null,
        })).toBe(false);
    });

    it('outranks a question handed over in router state', () => {
        expect(shouldSkipConversationRestore({
            routeConversationId: '7',
            hasInitialQuery: true,
            hasConversationId: true,
            isInitialQueryTransition: true,
        })).toBe(false);
    });
});

describe('no address at all', () => {
    it('stands back for a question handed over by the home page', () => {
        expect(shouldSkipConversationRestore({ hasInitialQuery: true })).toBe(true);
    });

    it('stands back for a conversation handed over in router state', () => {
        expect(shouldSkipConversationRestore({ hasConversationId: true })).toBe(true);
    });

    it('stands back across the gap where the handover has been consumed', () => {
        // location.state has already been cleared; only the ref still says it is happening.
        expect(shouldSkipConversationRestore({ isInitialQueryTransition: true })).toBe(true);
    });

    it('stands back while a run is streaming into an unnamed conversation', () => {
        expect(shouldSkipConversationRestore({ activeStreamId: STREAM })).toBe(true);
    });

    it('restores the last conversation when there is nothing else going on', () => {
        expect(shouldSkipConversationRestore({})).toBe(false);
        expect(shouldSkipConversationRestore()).toBe(false);
    });
});
