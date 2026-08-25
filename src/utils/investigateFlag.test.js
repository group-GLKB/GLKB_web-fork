/**
 * `is_investigate` — the server's answer to which conversations ran deep research.
 *
 * Backend spec: docs/history-investigate-flag.md on feat/history-investigate-flag. The column
 * is written only by /deep-research/stream, is sticky once set, and rides out on the history
 * summary, the detail, and the folder/favourite session listings.
 *
 * The field is read defensively because it is not deployed yet: a server without the column
 * omits it, and that has to read as "not investigate" rather than as undefined leaking into
 * an icon choice. These pin the reading, not the backend.
 */
import { fetchConversations } from './chatHistory';
import { listChatHistories, createChatHistory } from '../service/ChatHistory';

jest.mock('../service/ChatHistory', () => ({
    listChatHistories: jest.fn(),
    createChatHistory: jest.fn(),
    getChatHistoryDetail: jest.fn(),
    updateChatHistoryTitle: jest.fn(),
    deleteChatHistory: jest.fn(),
}));

const summary = (extra) => ({
    hid: 1,
    leading_title: 'A conversation',
    created_at: '2026-08-01T00:00:00Z',
    last_accessed_time: '2026-08-01T00:00:00Z',
    message_count: 2,
    ...extra,
});

beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    jest.clearAllMocks();
});

describe('reading the flag off a summary', () => {
    it('carries a true through', async () => {
        listChatHistories.mockResolvedValue({ histories: [summary({ is_investigate: true })] });
        const [conversation] = await fetchConversations();
        expect(conversation.isInvestigate).toBe(true);
    });

    it('carries a false through', async () => {
        listChatHistories.mockResolvedValue({ histories: [summary({ is_investigate: false })] });
        const [conversation] = await fetchConversations();
        expect(conversation.isInvestigate).toBe(false);
    });

    /** The case that matters until the column ships: the field simply is not there. */
    it('reads an absent field as not investigate, never as undefined', async () => {
        listChatHistories.mockResolvedValue({ histories: [summary()] });
        const [conversation] = await fetchConversations();
        expect(conversation.isInvestigate).toBe(false);
    });

    /** SMALLINT on the wire would be 1, but the API documents a JSON bool. */
    it('does not treat a truthy non-boolean as true', async () => {
        listChatHistories.mockResolvedValue({ histories: [summary({ is_investigate: 1 })] });
        const [conversation] = await fetchConversations();
        expect(conversation.isInvestigate).toBe(false);
    });
});

describe('labelling a conversation at creation', () => {
    it('sends the flag when the run is an investigate', async () => {
        createChatHistory.mockResolvedValue(summary({ is_investigate: true }));
        // eslint-disable-next-line global-require
        const { createConversation } = require('./chatHistory');
        await createConversation('A question', true);
        expect(createChatHistory).toHaveBeenCalledWith('A question', true);
    });

    it('leaves it off an ordinary chat', async () => {
        createChatHistory.mockResolvedValue(summary());
        // eslint-disable-next-line global-require
        const { createConversation } = require('./chatHistory');
        await createConversation('A question');
        expect(createChatHistory).toHaveBeenCalledWith('A question', false);
    });
});
