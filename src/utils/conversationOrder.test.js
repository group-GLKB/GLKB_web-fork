/**
 * The conversation being answered sits at the top of the sidebar while it runs.
 *
 * The list is ordered by `updatedAt`, which mirrors the server's `last_accessed_time`. That
 * field only moves when the list is refetched, and the refetch happens on `Complete` — so a
 * question asked in an older conversation left it at its old rank for the whole run and only
 * promoted it once the answer had already arrived. The run now dates its own conversation.
 *
 * Reading a conversation must NOT reorder anything: the effect that mirrors `chatHistory`
 * into the list also lands in `updateConversationMessages`, and it opts out.
 */
// The module reaches the API through this service, which pulls in axios; nothing here calls
// the network, so it is stubbed rather than transformed.
jest.mock('../service/ChatHistory', () => ({
    createChatHistory: jest.fn(),
    deleteChatHistory: jest.fn(),
    getChatHistoryDetail: jest.fn(),
    getChatHistoryDetailByPublicId: jest.fn(),
    listChatHistories: jest.fn(),
    updateChatHistoryTitle: jest.fn(),
}));

// eslint-disable-next-line import/first
import { updateConversationMessages } from './chatHistory';

const conversation = (id, updatedAt, messageCount = 2) => ({
    id,
    hid: Number(id),
    leadingTitle: `Conversation ${id}`,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt,
    messageCount,
    messages: [],
});

// Oldest first on purpose: '3' is last in the list and last by date, so a fix that merely
// preserved insertion order would still fail.
const list = () => ([
    conversation('1', '2026-08-27T12:00:00.000Z'),
    conversation('2', '2026-08-26T12:00:00.000Z'),
    conversation('3', '2026-08-25T12:00:00.000Z'),
]);

const ids = (result) => result.map((item) => item.id);

describe('updateConversationMessages ordering', () => {
    it('promotes the running conversation to the top while it is answering', () => {
        const next = updateConversationMessages(
            list(),
            '3',
            [{ role: 'user', content: 'What is TP53?' }],
            { touch: true },
        );
        expect(ids(next)).toEqual(['3', '1', '2']);
    });

    it('keeps it at the top across the deltas that follow', () => {
        let next = updateConversationMessages(
            list(),
            '3',
            [{ role: 'user', content: 'What is TP53?' }],
            { touch: true },
        );
        next = updateConversationMessages(
            next,
            '3',
            [
                { role: 'user', content: 'What is TP53?' },
                { role: 'assistant', content: 'TP53 is…' },
            ],
            { touch: true },
        );
        expect(ids(next)).toEqual(['3', '1', '2']);
    });

    it('leaves the order alone when a conversation is merely being read', () => {
        const next = updateConversationMessages(
            list(),
            '3',
            [{ role: 'user', content: 'an old question' }],
        );
        expect(ids(next)).toEqual(['1', '2', '3']);
    });

    it('still writes the messages through in both modes', () => {
        const messages = [{ role: 'user', content: 'hello' }];
        const touched = updateConversationMessages(list(), '2', messages, { touch: true });
        const untouched = updateConversationMessages(list(), '2', messages);
        expect(touched.find((item) => item.id === '2').messages).toBe(messages);
        expect(touched.find((item) => item.id === '2').messageCount).toBe(1);
        expect(untouched.find((item) => item.id === '2').messages).toBe(messages);
        expect(untouched.find((item) => item.id === '2').messageCount).toBe(1);
    });

    it('does not touch the conversations it was not asked about', () => {
        const before = list();
        const next = updateConversationMessages(before, '3', [], { touch: true });
        expect(next.find((item) => item.id === '1').updatedAt)
            .toBe('2026-08-27T12:00:00.000Z');
        expect(next.find((item) => item.id === '2').updatedAt)
            .toBe('2026-08-26T12:00:00.000Z');
    });
});
