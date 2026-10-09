/**
 * `fetchConversationPage` adds a page to what the browser already knows, and never subtracts.
 *
 * The store is one sessionStorage entry that several paths rewrite wholesale, and the list
 * loader was one of them — so a History page that had paged to 60 conversations was cut back
 * to 20 by the next thing that wrote the store. A page must merge, not replace.
 */
import { fetchConversationPage, getConversations, setConversations } from './chatHistory';

jest.mock('../service/ChatHistory', () => ({
    listChatHistories: jest.fn(),
    createChatHistory: jest.fn(),
    deleteChatHistory: jest.fn(),
    getChatHistoryDetail: jest.fn(),
    getChatHistoryDetailByPublicId: jest.fn(),
    updateChatHistoryTitle: jest.fn(),
}));
jest.mock('../service/activeRun', () => ({
    isConversationRunning: () => false,
    reconcileRunsWithServer: jest.fn(),
}));

const { listChatHistories } = require('../service/ChatHistory');

const summary = (hid, { minutesAgo = hid, messages = 2 } = {}) => ({
    hid,
    public_id: `pub-${hid}`,
    leading_title: `conv ${hid}`,
    created_at: new Date(Date.UTC(2026, 8, 16, 12, 0) - minutesAgo * 60000).toISOString(),
    last_accessed_time: new Date(Date.UTC(2026, 8, 16, 12, 0) - minutesAgo * 60000).toISOString(),
    message_count: messages,
});

const page = (hids, nextCursor, total) => ({
    histories: hids.map((hid) => summary(hid)),
    total,
    next_cursor: nextCursor,
});

beforeEach(() => {
    sessionStorage.clear();
    listChatHistories.mockReset();
});

it('returns the page, the server total and the cursor for the next one', async () => {
    listChatHistories.mockResolvedValueOnce(page([1, 2, 3], 'ts|3', 47));

    const result = await fetchConversationPage({ limit: 3 });

    expect(result.items.map((item) => item.id)).toEqual(['1', '2', '3']);
    expect(result.total).toBe(47);
    expect(result.nextCursor).toBe('ts|3');
    expect(listChatHistories).toHaveBeenCalledWith({ limit: 3, before: null });
});

it('asks for the next page by cursor, not by offset', async () => {
    listChatHistories.mockResolvedValueOnce(page([4, 5], null, 47));

    await fetchConversationPage({ limit: 3, before: 'ts|3' });

    expect(listChatHistories).toHaveBeenCalledWith({ limit: 3, before: 'ts|3' });
});

it('keeps the conversations already stored when a later page lands', async () => {
    listChatHistories.mockResolvedValueOnce(page([1, 2], 'ts|2', 4));
    await fetchConversationPage({ limit: 2 });

    listChatHistories.mockResolvedValueOnce(page([3, 4], null, 4));
    await fetchConversationPage({ limit: 2, before: 'ts|2' });

    // This is the regression: the store held 2 rows, and the second page must not replace
    // them — anything that re-reads the store would otherwise shrink the list back.
    expect(getConversations().map((item) => item.id).sort()).toEqual(['1', '2', '3', '4']);
});

it('does not resurrect a conversation deleted while a later page was loading', async () => {
    listChatHistories.mockResolvedValueOnce(page([1, 2], 'ts|2', 2));
    await fetchConversationPage({ limit: 2 });
    setConversations(getConversations().filter((item) => item.id !== '1'));

    listChatHistories.mockResolvedValueOnce(page([3], null, 1));
    await fetchConversationPage({ limit: 2, before: 'ts|2' });

    expect(getConversations().map((item) => item.id).sort()).toEqual(['2', '3']);
});

it('tolerates a server that sends no cursor', async () => {
    listChatHistories.mockResolvedValueOnce({ histories: [summary(1)], total: 1 });

    const result = await fetchConversationPage({ limit: 20 });

    expect(result.nextCursor).toBeNull();
    expect(result.items).toHaveLength(1);
});

it('reports no total rather than a wrong one when the server omits it', async () => {
    listChatHistories.mockResolvedValueOnce({ histories: [summary(1)], next_cursor: null });

    expect((await fetchConversationPage({ limit: 20 })).total).toBeNull();
});
