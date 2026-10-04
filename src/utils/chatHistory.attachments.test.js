/** A reloaded conversation shows the images and PDFs each question was sent with. */
import { fetchConversationDetail } from './chatHistory';

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

const { getChatHistoryDetail } = require('../service/ChatHistory');

beforeEach(() => {
    sessionStorage.clear();
    getChatHistoryDetail.mockReset();
});

it('carries a question\'s attachments, and leaves the others without the field', async () => {
    getChatHistoryDetail.mockResolvedValueOnce({
        hid: 9,
        public_id: 'pub-9',
        leading_title: 'A figure',
        last_accessed_time: '2026-10-04T12:00:00Z',
        created_at: '2026-10-04T11:00:00Z',
        messages: [
            {
                role: 'user',
                content: 'What does this figure show?',
                references: [],
                attachments: [
                    { id: 'i1', kind: 'image', mime_type: 'image/png', filename: 'fig.png', size_bytes: 1234, page_count: null },
                    { id: 'p1', kind: 'pdf', mime_type: 'application/pdf', filename: 'paper.pdf', size_bytes: 9, page_count: 12 },
                ],
            },
            { role: 'assistant', content: 'It shows…', references: [] },
            { role: 'user', content: 'And in mice?', references: [], attachments: [] },
        ],
    });

    const detail = await fetchConversationDetail('9');

    expect(detail.messages[0].attachments).toEqual([
        { id: 'i1', kind: 'image', mime_type: 'image/png', filename: 'fig.png', size_bytes: 1234, page_count: null },
        { id: 'p1', kind: 'pdf', mime_type: 'application/pdf', filename: 'paper.pdf', size_bytes: 9, page_count: 12 },
    ]);
    expect(detail.messages[1]).not.toHaveProperty('attachments');
    expect(detail.messages[2]).not.toHaveProperty('attachments');
});
