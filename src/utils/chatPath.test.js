/**
 * Each conversation has its own address.
 *
 * Before this, a conversation was identified only by router state and a sessionStorage
 * pointer. Router state does not survive a link being pasted or a page being reloaded, and
 * sessionStorage does not survive the tab closing — so reopening the app after closing it
 * had nothing to restore from, showed an empty chat, and bounced to the home page.
 *
 * `public_id` is the backend's UUID for the row. The primary key `hid` is not used in the
 * URL on purpose: it is sequential, so it would both enumerate other people's conversations
 * and disclose how many exist.
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
import { chatPathForConversation } from './chatHistory';

describe('chatPathForConversation', () => {
    it('addresses a conversation by its public id', () => {
        expect(chatPathForConversation({ publicId: '6a9108c0-c0a4-83ea-8090-67d8831dc24c' }))
            .toBe('/chat/6a9108c0-c0a4-83ea-8090-67d8831dc24c');
    });

    it('never puts the row id in the URL, even when that is all there is', () => {
        expect(chatPathForConversation({ id: '42', hid: 42 })).toBe('/chat');
    });

    it('falls back to plain /chat for a row the backend has not backfilled', () => {
        expect(chatPathForConversation({ id: '42', publicId: null })).toBe('/chat');
    });

    it('survives being handed nothing', () => {
        expect(chatPathForConversation(undefined)).toBe('/chat');
        expect(chatPathForConversation(null)).toBe('/chat');
        expect(chatPathForConversation({})).toBe('/chat');
    });
});
