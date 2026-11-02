/**
 * Where the chat page puts "Ask in Investigate", and what one click does.
 *
 * The notice itself, the flag and the hand-over are covered behaviourally in
 * SearchLimitNotice.test.jsx. What is left is glue inside a component of several thousand lines
 * with a live stream behind it, so it is asserted in the source, as composerMode.wiring.test.js
 * does — plus one real reload through the history store.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

jest.mock('../../service/ChatHistory', () => ({
    createChatHistory: jest.fn(),
    deleteChatHistory: jest.fn(),
    getChatHistoryDetail: jest.fn(),
    getChatHistoryDetailByPublicId: jest.fn(),
    listChatHistories: jest.fn(),
    updateChatHistoryTitle: jest.fn(),
}));

/* eslint-disable import/first */
import { getChatHistoryDetail } from '../../service/ChatHistory';
import { fetchConversationDetail } from '../../utils/chatHistory';
/* eslint-enable import/first */

const source = readFileSync(join(__dirname, 'index.jsx'), 'utf-8');
const between = (start, end) => {
    const from = source.indexOf(start);
    return source.slice(from, source.indexOf(end, from));
};

describe('the notice on the chat page', () => {
    it('sits under the answer, outside its markdown, so Copy and Download never carry it', () => {
        const body = between('<div className="markdown-body">', '{isAssistant && (');
        const notice = body.indexOf('<SearchLimitNotice');
        expect(notice).toBeGreaterThan(-1);
        // The markdown body closes before the notice opens.
        expect(body.lastIndexOf('</div>', notice)).toBeGreaterThan(body.indexOf('<ReactMarkdown'));
        // Copy and Download take the answer's own text.
        expect(source).toContain('onClick={() => copy(message.content)}');
        expect(source).toContain("conversationText += assistantMessage.content + '\\n';");
    });

    it('shows only for a settled chat answer the agent cut short', () => {
        expect(source).toMatch(/const showSearchLimit = !isLoading && !showReloadInMessage && Boolean\(onAskInInvestigate\)\s*&& showsSearchLimit\(message\);/);
    });

    it('carries the flag onto every finished chat answer: live, detached and in the background', () => {
        expect(source.match(/searchLimit: update\.searchLimit \|\| null,/g)).toHaveLength(2);
        expect(source).toContain('searchLimit: update.searchLimit ?? searchLimitOf(update.search_limit),');
    });

    it('opens a new Investigate conversation the way the home composer does, or asks a guest to sign in', () => {
        const handler = between('const handleAskInInvestigate = (index) => {', 'const handleReloadLatest');
        expect(handler).toContain('investigateQuestionFor(chatHistory, index)');
        expect(handler).toMatch(/if \(isGuest\) \{\s*requireSignIn\(GUEST_INVESTIGATE_REASON\);\s*return;/);
        expect(handler).toContain('navigate(CHAT_NEW_PATH, { state: investigateHandoffState(question, serviceTier) });');
        // Nothing is fetched or awaited on the way: the hand-over effect starts the run.
        expect(handler).not.toMatch(/await|fetch/);
    });
});

describe('a reloaded answer', () => {
    it('comes back with the flag from its stored trace', async () => {
        getChatHistoryDetail.mockResolvedValue({
            hid: 9,
            public_id: 'p-9',
            leading_title: 'NR4A1',
            created_at: '2026-11-01T10:00:00',
            last_accessed_time: '2026-11-01T10:05:00',
            messages: [
                { id: 1, pair_index: 0, role: 'user', content: 'How does NR4A1 drive exhaustion?' },
                {
                    id: 2,
                    pair_index: 0,
                    role: 'assistant',
                    content: 'Partly…',
                    trace: {
                        v: 1,
                        mode: 'chat',
                        complete: true,
                        duration_ms: 40000,
                        frames: [{ step: 'Processing', content: 'Searching' }, { step: 'Complete', search_limit: 'calls' }],
                    },
                },
            ],
        });
        const conversation = await fetchConversationDetail(9);
        expect(conversation.messages[1].searchLimit).toBe('calls');
        expect(conversation.messages[0].searchLimit).toBeUndefined();
    });
});
