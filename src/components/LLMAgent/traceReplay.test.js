/**
 * A reloaded turn shows the trace the reader watched live.
 *
 * The backend stores the frames it relayed with each answer (`trace` on a history message,
 * see glkb-backend app/services/trace_recorder.py) and `replayTrace` folds them back into the
 * fields the live stream builds. The frames below are the recorder's output shape: `Thinking`
 * folded to one frame, each narration `Delta` block folded to one frame, the answer's own
 * block dropped, and a `Complete` stub carrying only counts.
 */
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
import { frameToUpdate } from '../../service/LLMAgent';
import { fetchConversationDetail } from '../../utils/chatHistory';
import { replayTrace } from './traceReplay';
/* eslint-enable import/first */

const TOOL_FRAME = {
    step: 'Processing',
    content: '[TOOL CALL] search_pubmed | Input: {"query": "BRCA1"}',
};

const CHAT_TRACE = {
    v: 1,
    mode: 'chat',
    duration_ms: 41250,
    complete: true,
    truncated: false,
    trajectory: [],
    frames: [
        { step: 'Started', run_id: 'run-1', session_id: 's-1' },
        { step: 'Thinking', delta: 'Checking what is known about BRCA1.' },
        { step: 'Delta', block: 0, delta: "I'll search PubMed for BRCA1 repair studies." },
        TOOL_FRAME,
        { step: 'Delta', block: 1, delta: 'Now I will read the two strongest papers.' },
        { step: 'Processing', content: 'Reading 2 articles' },
    ],
};

const INVESTIGATE_TRACE = {
    v: 1,
    mode: 'investigate',
    duration_ms: 512000,
    complete: true,
    trajectory: [],
    frames: [
        { step: 'Started', run_id: 'dr-1', session_id: 'web_dr_1', phase: 'planning' },
        {
            type: 'progress', step: 'Searching', phase: 'searching', percent: 20,
            label: 'Searching 3 facets', funnel: { retrieved: 900 }, keywords: ['EGFR', 'osimertinib'],
        },
        {
            type: 'progress', step: 'Screening', phase: 'screening', percent: 55,
            label: 'Screening candidates', funnel: { retrieved: 1200, screened: 140 },
            keywords: ['C797S'],
        },
        { step: 'Complete', funnel: { extracted: 60, cited: 31 } },
    ],
};

describe('replayTrace — chat', () => {
    const fields = replayTrace(CHAT_TRACE);

    it('rebuilds the thought list in the order the live view built it', () => {
        const toolContent = frameToUpdate(TOOL_FRAME).content;
        expect(fields.thinkingSteps).toEqual([
            { step: 'Thinking', content: 'Checking what is known about BRCA1.', isThought: true },
            { step: 'Processing', content: toolContent },
            // Narration moves into the thoughts when the NEXT block starts, i.e. after the
            // tool call it led to — exactly as the live `delta` handler does.
            { step: 'Thinking', content: "I'll search PubMed for BRCA1 repair studies.", isThought: true },
            { step: 'Processing', content: 'Reading 2 articles' },
            { step: 'Thinking', content: 'Now I will read the two strongest papers.', isThought: true },
        ]);
    });

    it('restores how long the answer took to think', () => {
        expect(fields.thoughtDurationMs).toBe(41250);
    });

    it('does not claim a chat turn was an investigation', () => {
        expect(fields.investigateMode).toBeUndefined();
        expect(fields.investigateFunnel).toBeUndefined();
    });

    it('carries the trajectory when the agent sent one', () => {
        const withTrajectory = replayTrace({ ...CHAT_TRACE, trajectory: [{ phase: 'Search', actions: [] }] });
        expect(withTrajectory.trajectory).toEqual([{ phase: 'Search', actions: [] }]);
        expect(fields.trajectory).toBeUndefined();
    });
});

describe('replayTrace — investigate', () => {
    const fields = replayTrace(INVESTIGATE_TRACE);

    it('restores the investigation summary: mode, funnel, phase, percent, keywords', () => {
        expect(fields.investigateMode).toBe(true);
        expect(fields.investigateFunnel).toEqual({ retrieved: 1200, screened: 140, extracted: 60, cited: 31 });
        expect(fields.investigatePhase).toBe('screening');
        expect(fields.investigatePercent).toBe(100);
        expect(fields.investigateKeywords).toEqual(['EGFR', 'osimertinib', 'C797S']);
        expect(fields.thoughtDurationMs).toBe(512000);
    });

    it('rebuilds the progress steps the summary expands to', () => {
        expect(fields.thinkingSteps).toEqual([
            { step: 'Searching', content: 'Searching 3 facets', isProgress: true, phase: 'searching' },
            { step: 'Screening', content: 'Screening candidates', isProgress: true, phase: 'screening' },
        ]);
    });

    it('does not show a stopped investigation as finished', () => {
        const stopped = replayTrace({
            ...INVESTIGATE_TRACE,
            complete: false,
            frames: INVESTIGATE_TRACE.frames.slice(0, 3),
        });
        expect(stopped.investigatePercent).toBe(55);
    });
});

describe('replayTrace — no usable trace', () => {
    it.each([null, undefined, '', 'not json', { frames: 'nope' }, 42])(
        'returns {} for %p, so an older answer reloads as it did before',
        (value) => {
            expect(replayTrace(value)).toEqual({});
        },
    );

    it('accepts the trace as a JSON string', () => {
        expect(replayTrace(JSON.stringify(CHAT_TRACE)).thoughtDurationMs).toBe(41250);
    });
});

describe('a reloaded conversation', () => {
    beforeEach(() => sessionStorage.clear());

    it('comes back from the history with each answer\'s trace in place', async () => {
        getChatHistoryDetail.mockResolvedValue({
            hid: 5,
            public_id: 'p-5',
            leading_title: 'BRCA1',
            created_at: '2026-09-23T10:00:00',
            last_accessed_time: '2026-09-23T10:05:00',
            is_investigate: true,
            messages: [
                { id: 1, pair_index: 0, role: 'user', content: 'What is BRCA1?', created_at: '2026-09-23T10:00:00' },
                {
                    id: 2, pair_index: 0, role: 'assistant', content: 'BRCA1 is…',
                    created_at: '2026-09-23T10:00:41', trace: CHAT_TRACE,
                },
                { id: 3, pair_index: 1, role: 'user', content: 'Investigate EGFR resistance', created_at: '2026-09-23T10:01:00' },
                {
                    id: 4, pair_index: 1, role: 'assistant', content: '# Report',
                    created_at: '2026-09-23T10:09:32', trace: INVESTIGATE_TRACE,
                },
                // Saved before traces were stored.
                { id: 5, pair_index: 2, role: 'assistant', content: 'old', created_at: '2026-09-01T10:00:00' },
            ],
        });

        const conversation = await fetchConversationDetail(5);
        const [question, chat, , investigation, old] = conversation.messages;

        expect(question.thinkingSteps).toBeUndefined();
        expect(chat.thinkingSteps).toHaveLength(5);
        expect(chat.thoughtDurationMs).toBe(41250);
        expect(chat.investigateMode).toBeUndefined();
        expect(investigation.investigateMode).toBe(true);
        expect(investigation.investigateFunnel.cited).toBe(31);
        expect(investigation.thinkingSteps).toHaveLength(2);
        expect(old.thinkingSteps).toBeUndefined();
        expect(old.trajectory).toBeNull();
    });
});
