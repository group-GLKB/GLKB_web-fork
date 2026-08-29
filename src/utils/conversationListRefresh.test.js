/**
 * Refreshing the conversation list must not erase locally known transcripts.
 *
 * The list endpoint returns summaries — titles and counts, `messages: []` — and the refresh
 * used to replace the stored list with them wholesale. Every refresh therefore wiped every
 * conversation's local messages, including the optimistic turn of a run still in flight:
 * the only record of a question the server had not saved yet. Opening that conversation then
 * showed the server's shorter history, and the question the reader had queued looked like it
 * never existed. The refresh happens on every `saved` frame and on every mount, so this was
 * constant, quiet data loss.
 */
jest.mock('../service/ChatHistory', () => ({
    createChatHistory: jest.fn(),
    deleteChatHistory: jest.fn(),
    getChatHistoryDetail: jest.fn(),
    getChatHistoryDetailByPublicId: jest.fn(),
    listChatHistories: jest.fn(),
    updateChatHistoryTitle: jest.fn(),
}));

// eslint-disable-next-line import/first
import {
    fetchConversations,
    getConversations,
    setConversations,
} from './chatHistory';
// eslint-disable-next-line import/first
import { listChatHistories } from '../service/ChatHistory';

const summaryRow = (hid, title) => ({
    hid,
    public_id: `pub-${hid}`,
    leading_title: title,
    created_at: '2026-08-01T00:00:00.000Z',
    last_accessed_time: '2026-08-29T00:00:00.000Z',
    message_count: 2,
});

const storedConversation = (id, messages) => ({
    id: String(id),
    hid: id,
    leadingTitle: `Conversation ${id}`,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
    messageCount: messages.length,
    messages,
});

beforeEach(() => {
    sessionStorage.clear();
    // The store prunes zero-message rows outside a chat page; the messages under test
    // are non-empty, so the default '/' location is fine.
});

describe('fetchConversations', () => {
    it('keeps stored messages when the incoming summary has none', async () => {
        const messages = [
            { role: 'user', content: 'What is BRCA1?' },
            { role: 'assistant', content: '' },
        ];
        setConversations([storedConversation(7, messages)]);
        listChatHistories.mockResolvedValue({ histories: [summaryRow(7, 'What is BRCA1?')] });

        await fetchConversations();

        const stored = getConversations().find((item) => item.id === '7');
        expect(stored.messages).toHaveLength(2);
        expect(stored.messages[0].content).toBe('What is BRCA1?');
        // The summary's own fields still win — it is fresher about everything but messages.
        expect(stored.publicId).toBe('pub-7');
    });

    /* Only the in-flight copy is worth protecting. A settled local copy can hold stale or
       error text the server never saved; preserving it unconditionally meant a refresh could
       never repair it, and the sidebar counts drifted from what is actually saved. */
    it('lets the refresh repair a settled local copy', async () => {
        const messages = [
            { role: 'user', content: 'Q' },
            { role: 'assistant', content: 'a stale local answer' },
        ];
        setConversations([storedConversation(7, messages)]);
        listChatHistories.mockResolvedValue({ histories: [summaryRow(7, 'Repaired')] });

        await fetchConversations();

        expect(getConversations().find((item) => item.id === '7').messages).toEqual([]);
    });

    it('does not resurrect messages for a row the reader deleted elsewhere', async () => {
        listChatHistories.mockResolvedValue({ histories: [summaryRow(9, 'Fresh row')] });
        await fetchConversations();
        const stored = getConversations().find((item) => item.id === '9');
        expect(stored.messages).toEqual([]);
    });

    /* A run touches its conversation locally the moment it starts writing; the server's
       last_accessed_time lags until the answer is saved. Taking the older summary timestamp
       dropped the conversation being answered down the sidebar mid-run. */
    it('keeps the newer local timestamp so a mid-run conversation stays on top', async () => {
        const messages = [{ role: 'user', content: 'Q' }, { role: 'assistant', content: '' }];
        setConversations([{
            ...storedConversation(7, messages),
            updatedAt: '2026-08-29T10:00:00.000Z',
        }]);
        listChatHistories.mockResolvedValue({
            histories: [
                { ...summaryRow(7, 'Mid-run'), last_accessed_time: '2026-08-29T09:00:00.000Z' },
                { ...summaryRow(8, 'Finished later'), last_accessed_time: '2026-08-29T09:30:00.000Z' },
            ],
        });

        await fetchConversations();

        expect(getConversations().map((item) => item.id)).toEqual(['7', '8']);
    });

    it('takes the server timestamp when it is the newer one', async () => {
        const messages = [{ role: 'user', content: 'Q' }, { role: 'assistant', content: 'A' }];
        setConversations([{
            ...storedConversation(7, messages),
            updatedAt: '2026-08-29T09:00:00.000Z',
        }]);
        listChatHistories.mockResolvedValue({
            histories: [
                { ...summaryRow(7, 'Touched on another device'), last_accessed_time: '2026-08-29T10:00:00.000Z' },
            ],
        });

        await fetchConversations();

        expect(getConversations()[0].updatedAt).toBe('2026-08-29T10:00:00.000Z');
    });
});
