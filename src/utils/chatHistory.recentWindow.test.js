/**
 * A refresh of the newest page rewrites the newest page — not the whole store.
 *
 * Reported: the sidebar's Recent section never showed more than twenty conversations, however
 * many the reader had. It renders up to fifty, but the fetch behind it asked for the default
 * twenty AND replaced the store with exactly those twenty. So the cap was unreachable, and the
 * same call cut a History page that had paged to a hundred rows back to the newest twenty
 * every time an answer finished (`fetchConversations` runs on every saved stream frame).
 *
 * Asking for fifty fixes the first half. This file covers the second: what a page of the list
 * is allowed to say about the conversations underneath it — nothing, unless the page was too
 * short to fill, in which case it was the whole list and the rest really are gone.
 */
import {
    conversationsBelowPage,
    fetchConversations,
    getConversations,
    RECENT_CONVERSATION_LIMIT,
    setConversations,
} from './chatHistory';

jest.mock('../service/ChatHistory', () => ({
    listChatHistories: jest.fn(),
    createChatHistory: jest.fn(),
    deleteChatHistory: jest.fn(),
    getChatHistoryDetail: jest.fn(),
    getChatHistoryDetailByPublicId: jest.fn(),
    updateChatHistoryTitle: jest.fn(),
}));
/* `var`, and the `mock` prefix, because jest hoists the factory above this file's own
   declarations — the Set is read when the mocked function is called, not when it is defined. */
var mockRunning = new Set();

jest.mock('../service/activeRun', () => ({
    isConversationRunning: (id) => mockRunning.has(String(id)),
    reconcileRunsWithServer: jest.fn(),
}));
/* `../service/resumeRun` is deliberately NOT mocked. It is a pure predicate with no imports,
   and what matters here is whether the REAL rule for "still being answered" protects a
   transcript — a stub that answers on a fixture's shape instead would pass whatever this file
   happened to build. */

const { listChatHistories } = require('../service/ChatHistory');

const at = (minutesAgo) => new Date(Date.UTC(2026, 8, 17, 12, 0) - minutesAgo * 60000).toISOString();

/* Newest first: conversation 1 is the most recent, 100 the oldest. */
const summary = (hid) => ({
    hid,
    public_id: `pub-${hid}`,
    leading_title: `conv ${hid}`,
    created_at: at(hid),
    last_accessed_time: at(hid),
    message_count: 2,
});

const storedRow = (hid) => ({
    id: hid,
    publicId: `pub-${hid}`,
    title: `conv ${hid}`,
    updatedAt: at(hid),
    messages: [{ role: 'user', content: 'q' }, { role: 'assistant', content: 'a' }],
});

const ids = (list) => list.map((item) => Number(item.id));

beforeEach(() => {
    sessionStorage.clear();
    listChatHistories.mockReset();
    mockRunning.clear();
});

describe('what a full page says about the rows below it', () => {
    it('says nothing — they stay', () => {
        const page = [1, 2, 3].map(storedRow);
        const stored = [1, 2, 3, 4, 5].map(storedRow);

        expect(ids(conversationsBelowPage(page, stored, 3))).toEqual([4, 5]);
    });

    it('still drops a row inside the window that did not come back', () => {
        // Deleted in another tab: it is newer than the page's last row, so the page's silence
        // about it is an answer.
        const page = [1, 3, 4].map(storedRow);
        const stored = [1, 2, 3, 4, 9].map(storedRow);

        expect(ids(conversationsBelowPage(page, stored, 3))).toEqual([9]);
    });

    it('keeps nothing when the page could not be filled', () => {
        // Three rows back from a request for ten is the whole list.
        const page = [1, 2, 3].map(storedRow);
        const stored = [1, 2, 3, 4, 5].map(storedRow);

        expect(conversationsBelowPage(page, stored, 10)).toEqual([]);
    });

    it('keeps a row that ties the page\'s last timestamp', () => {
        // The server breaks that tie on an id this list does not carry, so the page cannot
        // say whether the row is the next one down or was deleted. Dropping it loses a real
        // conversation out of the middle of the list; keeping it costs a stale row at the
        // very edge of a window every caller validates in full.
        const page = [storedRow(1), storedRow(2)];
        const tied = { ...storedRow(9), updatedAt: at(2) };
        const stored = [storedRow(1), storedRow(2), tied];

        expect(ids(conversationsBelowPage(page, stored, 2))).toEqual([9]);
    });

    it('keeps nothing when the page places no boundary', () => {
        const page = [storedRow(1), { ...storedRow(2), updatedAt: 'not a date' }];
        const stored = [1, 2, 7].map(storedRow);

        expect(conversationsBelowPage(page, stored, 2)).toEqual([]);
    });

    it('is not confused by a row and a page entry whose ids differ in type', () => {
        const page = [{ ...storedRow(1), id: '1' }, { ...storedRow(2), id: '2' }];
        const stored = [1, 2, 6].map(storedRow);

        expect(ids(conversationsBelowPage(page, stored, 2))).toEqual([6]);
    });
});

describe('a refresh of the newest page', () => {
    it('leaves the conversations a deeper page loaded in the store', async () => {
        setConversations(Array.from({ length: 60 }, (unused, i) => storedRow(i + 1)));
        listChatHistories.mockResolvedValue({
            histories: [1, 2, 3, 4, 5].map(summary),
            total: 60,
        });

        const list = await fetchConversations({ limit: 5 });

        expect(list).toHaveLength(60);
        expect(ids(getConversations())).toHaveLength(60);
        expect(ids(list).slice(0, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('still forgets what the server no longer lists, within the page it asked for', async () => {
        setConversations([1, 2, 3, 4, 5, 6].map(storedRow));
        listChatHistories.mockResolvedValue({
            histories: [1, 3, 4].map(summary), // 2 was deleted elsewhere
            total: 5,
        });

        await fetchConversations({ limit: 3 });

        expect(ids(getConversations())).toEqual([1, 3, 4, 5, 6]);
    });

    it('replaces the store wholesale when the list fits in one page', async () => {
        setConversations([1, 2, 3, 4, 5].map(storedRow));
        listChatHistories.mockResolvedValue({
            histories: [1, 3].map(summary),
            total: 2,
        });

        await fetchConversations({ limit: 20 });

        expect(ids(getConversations())).toEqual([1, 3]);
    });

    it('asks the server for the page size it was given', async () => {
        listChatHistories.mockResolvedValue({ histories: [], total: 0 });

        await fetchConversations({ limit: 50 });

        expect(listChatHistories).toHaveBeenCalledWith({ offset: 0, limit: 50 });
    });

    it('validates as many conversations as any view is allowed to draw', async () => {
        /* The store is shared, so a refresh narrower than the widest view leaves the rows in
           between frozen: a conversation deleted in another tab kept its place in the sidebar
           and opened nothing when clicked. One number, defaulted — not passed by each caller.
           The sidebar's own cap is this same constant (see NavBarWhite). */
        listChatHistories.mockResolvedValue({ histories: [], total: 0 });

        await fetchConversations();

        expect(listChatHistories).toHaveBeenCalledWith({
            offset: 0, limit: RECENT_CONVERSATION_LIMIT,
        });
    });

    it('drops a conversation deleted elsewhere from anywhere in that window', async () => {
        setConversations(Array.from({ length: 60 }, (unused, i) => storedRow(i + 1)));
        const survivors = Array.from({ length: 50 }, (unused, i) => i + 1).filter((id) => id !== 35);
        listChatHistories.mockResolvedValue({
            histories: [...survivors, 51].map(summary), // 35 deleted, 51 takes the free slot
            total: 59,
        });

        await fetchConversations();

        const stored = ids(getConversations());
        expect(stored).not.toContain(35);
        expect(stored).toHaveLength(59);
    });

    it('falls back to replacing when a caller pages by offset', async () => {
        // `offset` puts the window somewhere this cannot reason about; no caller does it, and
        // guessing at a boundary would be worse than the behaviour that was always there.
        setConversations([1, 2, 3, 4, 5].map(storedRow));
        listChatHistories.mockResolvedValue({ histories: [3, 4].map(summary), total: 5 });

        await fetchConversations({ offset: 2, limit: 2 });

        expect(ids(getConversations())).toEqual([3, 4]);
    });
});

describe('the transcripts of the conversations it keeps', () => {
    /* A row below the window never passes through `mergeSummaryWithStored`, which is what
       evicts a settled transcript everywhere else. Without an equivalent rule here the answers
       of every conversation the reader opened would sit in sessionStorage for the life of the
       tab — and that store's quota fails silently. */
    const withTranscript = (hid, text) => ({
        ...storedRow(hid),
        messageCount: 2,
        messages: [{ role: 'user', content: text }, { role: 'assistant', content: 'a long answer' }],
    });

    const storedById = (hid) => getConversations().find((item) => String(item.id) === String(hid));

    beforeEach(() => {
        listChatHistories.mockResolvedValue({ histories: [1, 2].map(summary), total: 40 });
    });

    it('keeps the row and drops the answer it no longer needs to hold', async () => {
        setConversations([storedRow(1), storedRow(2), withTranscript(9, 'settled')]);

        await fetchConversations({ limit: 2 });

        expect(storedById(9)).toBeDefined();
        expect(storedById(9).messages).toEqual([]);
        // The row still knows its size, so it is not pruned away as an empty conversation.
        expect(storedById(9).messageCount).toBe(2);
    });

    it('keeps the transcript of a conversation still being answered', async () => {
        setConversations([storedRow(1), storedRow(2), withTranscript(9, 'running')]);
        mockRunning.add('9');

        await fetchConversations({ limit: 2 });

        expect(storedById(9).messages).toHaveLength(2);
    });

    it('keeps the transcript of an exchange that stops mid-answer', async () => {
        // The shape the real predicate calls unfinished: the prompt is saved the moment it is
        // sent, and the answer's row is written only when the run finishes.
        const midAnswer = {
            ...storedRow(9),
            messageCount: 3,
            messages: [
                { role: 'user', content: 'first' },
                { role: 'assistant', content: 'an answer' },
                { role: 'user', content: 'and the follow-up still being answered' },
            ],
        };
        setConversations([storedRow(1), storedRow(2), midAnswer]);

        await fetchConversations({ limit: 2 });

        expect(storedById(9).messages).toHaveLength(3);
    });

    it('keeps the transcript while an answer is still being written into it', async () => {
        // The other unfinished shape: the empty assistant row the chat appends locally while
        // the run is in flight.
        const streaming = {
            ...storedRow(9),
            messageCount: 2,
            messages: [
                { role: 'user', content: 'a question' },
                { role: 'assistant', content: '' },
            ],
        };
        setConversations([storedRow(1), storedRow(2), streaming]);

        await fetchConversations({ limit: 2 });

        expect(storedById(9).messages).toHaveLength(2);
    });

    it('keeps the transcript when it is the only record of how long the conversation is', async () => {
        // Without a count, an emptied row reads as a zero-message conversation and is pruned
        // out of the store altogether — losing the conversation, not just its text.
        const noCount = { ...withTranscript(9, 'countless'), messageCount: undefined };
        setConversations([storedRow(1), storedRow(2), noCount]);

        await fetchConversations({ limit: 2 });

        expect(storedById(9)).toBeDefined();
        expect(storedById(9).messages).toHaveLength(2);
    });
});
