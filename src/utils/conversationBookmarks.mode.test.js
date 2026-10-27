import { fetchConversationBookmarks, toggleConversationBookmark } from './conversationBookmarks';
import { listFavoriteChats, addFavoriteChat } from '../service/Favorites';
jest.mock('../service/Favorites', () => ({ listFavoriteChats: jest.fn(), addFavoriteChat: jest.fn(), removeFavoriteChat: jest.fn() }));
beforeEach(() => { sessionStorage.clear(); jest.clearAllMocks(); });
it('keeps review mode when reading saved conversations', async () => {
    listFavoriteChats.mockResolvedValue({ sessions: [{ hid: 9, mode: 'literature_review' }] });
    expect((await fetchConversationBookmarks())[0].mode).toBe('literature_review');
});
it('keeps review mode immediately when bookmarking a conversation', async () => {
    addFavoriteChat.mockResolvedValue({});
    expect((await toggleConversationBookmark({ id: 9, mode: 'literature_review' }))[0].mode).toBe('literature_review');
});
