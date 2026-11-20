/**
 * The side chat's transport and request (service/sideChat.js).
 *
 * Pinned here:
 *   * the conversation goes as `history_id` for a signed-in reader's saved conversation, as
 *     `turns` otherwise (a guest's), never both; the running turn as `in_progress` with its
 *     partial answer and progress lines, and never also as a finished turn;
 *   * the request carries the question, the finished side thread, the quote and the tier;
 *   * the stream is read frame by frame; a refusal from before the stream opened comes back as
 *     `error.refusal`; Stop (an abort) is not an error;
 *   * ⌘; and Ctrl+; are the shortcut.
 */
import axios from '../utils/axiosConfig';
import {
    isSideChatShortcut,
    readSseFrames,
    referencesForSideChat,
    runProgressLines,
    SIDE_CHAT_ENDPOINT,
    sideChatContext,
    sideChatRequest,
    sideChatShortcutLabel,
    streamSideChat,
} from './sideChat';

jest.mock('../utils/axiosConfig', () => ({ __esModule: true, default: { post: jest.fn() } }));

const conversation = [
    { role: 'user', content: 'Which genes drive islet development?' },
    {
        role: 'assistant',
        content: 'RFX6 and NGN3 [1](https://pubmed.ncbi.nlm.nih.gov/31234567/).',
        references: [{ title: 'RFX6', url: 'https://pubmed.ncbi.nlm.nih.gov/31234567/', year: 2019, journal: 'Diabetes' }],
    },
    { role: 'user', content: 'And in adults?', investigateMode: true },
    { role: 'assistant', content: 'So far: PDX1', investigateMode: true },
];

describe('the conversation the side chat reads', () => {
    it('names a signed-in reader\'s saved conversation and sends no turns', () => {
        const context = sideChatContext({ messages: conversation, historyId: '42' });
        expect(context.history_id).toBe(42);
        expect(context.turns).toBeUndefined();
        expect(context.in_progress).toBeUndefined();
    });

    it('sends a guest\'s exchanges as turns, with their references', () => {
        const context = sideChatContext({ messages: conversation, historyId: 'local-1', isGuest: true });
        expect(context.history_id).toBeUndefined();
        expect(context.turns).toHaveLength(2);
        expect(context.turns[0]).toEqual({
            question: 'Which genes drive islet development?',
            answer: 'RFX6 and NGN3 [1](https://pubmed.ncbi.nlm.nih.gov/31234567/).',
            references: [{ pmid: '31234567', title: 'RFX6', journal: 'Diabetes', year: '2019' }],
            investigate: false,
        });
        expect(context.turns[1].investigate).toBe(true);
    });

    it('a guest id that looks like a number is still a guest\'s', () => {
        expect(sideChatContext({ messages: conversation, historyId: 7, isGuest: true }).history_id).toBeUndefined();
    });

    it('sends the running turn as in progress, not as a finished turn', () => {
        const context = sideChatContext({
            messages: conversation,
            isGuest: true,
            running: true,
            progress: ['Searching GLKB', '  ', 'Reading   4 papers'],
        });
        expect(context.turns).toHaveLength(1);
        expect(context.in_progress).toEqual({
            question: 'And in adults?',
            answer: 'So far: PDX1',
            progress: ['Searching GLKB', 'Reading 4 papers'],
            investigate: true,
        });
    });

    it('a run that has no answer bubble yet is its question alone', () => {
        const context = sideChatContext({
            messages: [...conversation.slice(0, 2), { role: 'user', content: 'Next?' }],
            historyId: 9,
            running: true,
        });
        expect(context).toEqual({
            history_id: 9,
            in_progress: { question: 'Next?', answer: '', progress: [], investigate: false },
        });
    });

    it('keeps only the newest exchanges of a long guest conversation', () => {
        const long = [];
        for (let i = 0; i < 40; i += 1) {
            long.push({ role: 'user', content: `q${i}` }, { role: 'assistant', content: `a${i}` });
        }
        const { turns } = sideChatContext({ messages: long, isGuest: true });
        expect(turns).toHaveLength(30);
        expect(turns[29].question).toBe('q39');
    });

    it('reads both reference shapes the chat holds', () => {
        expect(referencesForSideChat([
            ['Legacy', 'https://pubmed.ncbi.nlm.nih.gov/111/', 3, 2001, 'Nature', []],
            { pmid: 222, title: 'Dict', date: '2020-01-01' },
            { title: '' },
        ])).toEqual([
            { pmid: '111', title: 'Legacy', journal: 'Nature', year: '2001' },
            { pmid: '222', title: 'Dict', journal: null, year: '2020-01-01' },
        ]);
    });

    it('turns the progress panel into lines: each step with its newest line, then what is happening now', () => {
        expect(runProgressLines({
            groups: [
                { name: 'Thinking', lines: ['I will look for islet papers.'] },
                { name: 'Searching', lines: ['article_search', 'Found 12 papers'] },
                { name: 'Reading', lines: [] },
            ],
            current: 'Reading the papers',
        })).toEqual([
            'Thinking: I will look for islet papers.',
            'Searching: Found 12 papers',
            'Reading',
            'Now: Reading the papers',
        ]);
    });
});

describe('the request', () => {
    it('carries the question, the finished thread, the quote and the tier', () => {
        const body = sideChatRequest({
            question: '  What is RFX6? ',
            quote: ' RFX6 is required ',
            serviceTier: 'Advanced',
            context: { history_id: 3 },
            thread: [
                { role: 'user', content: 'Earlier?' },
                { role: 'assistant', content: 'Yes.' },
                { role: 'assistant', content: '   ' },
                { role: 'system', content: 'x' },
            ],
        });
        expect(body).toEqual({
            history_id: 3,
            question: 'What is RFX6?',
            quote: 'RFX6 is required',
            service_tier: 'advanced',
            thread: [{ role: 'user', content: 'Earlier?' }, { role: 'assistant', content: 'Yes.' }],
        });
    });

    it('leaves the quote and tier off when there are none', () => {
        const body = sideChatRequest({ question: 'q' });
        expect(body).toEqual({ question: 'q', thread: [] });
    });
});

describe('the stream', () => {
    beforeEach(() => axios.post.mockReset());

    it('reads frames, keeping a line that has not finished', () => {
        const { frames, rest } = readSseFrames('data: {"step":"Delta","delta":"a"}\n\n: heartbeat\n\ndata: {"step":"Del');
        expect(frames).toEqual([{ step: 'Delta', delta: 'a' }]);
        expect(rest).toBe('data: {"step":"Del');
    });

    it('hands each frame over as it arrives', async () => {
        axios.post.mockImplementation((url, body, config) => {
            const xhr = { responseText: '' };
            xhr.responseText = 'data: {"step":"Delta","delta":"RFX6 "}\n\n';
            config.onDownloadProgress({ event: { target: xhr } });
            xhr.responseText += 'data: {"step":"Delta","delta":"is"}\n\ndata: {"step":"Complete","answer":"RFX6 is"}\n\n';
            config.onDownloadProgress({ event: { target: xhr } });
            return Promise.resolve({ data: xhr.responseText });
        });
        const frames = [];
        await streamSideChat({ question: 'q' }, { onFrame: (f) => frames.push(f) });
        expect(axios.post).toHaveBeenCalledWith(SIDE_CHAT_ENDPOINT, { question: 'q' }, expect.objectContaining({ responseType: 'text' }));
        expect(frames.map((f) => f.step)).toEqual(['Delta', 'Delta', 'Complete']);
        expect(frames[2].answer).toBe('RFX6 is');
    });

    it('turns a refusal into error.refusal', async () => {
        const error = new Error('429');
        error.response = { status: 429, data: JSON.stringify({ detail: { code: 'INSUFFICIENT_CREDITS', message: 'Not enough credits.' } }) };
        axios.post.mockRejectedValue(error);
        await expect(streamSideChat({ question: 'q' }, {})).rejects.toMatchObject({
            refusal: { code: 'INSUFFICIENT_CREDITS', status: 429, message: 'Not enough credits.' },
        });
    });

    it('is not an error when the reader stops it', async () => {
        const error = new Error('canceled');
        error.code = 'ERR_CANCELED';
        axios.post.mockRejectedValue(error);
        await expect(streamSideChat({ question: 'q' }, {})).resolves.toBeUndefined();
    });
});

describe('the shortcut', () => {
    it('is ⌘; or Ctrl+;, and nothing else', () => {
        expect(isSideChatShortcut({ key: ';', metaKey: true })).toBe(true);
        expect(isSideChatShortcut({ key: ';', ctrlKey: true })).toBe(true);
        expect(isSideChatShortcut({ code: 'Semicolon', key: 'ö', ctrlKey: true })).toBe(true);
        expect(isSideChatShortcut({ key: ';' })).toBe(false);
        expect(isSideChatShortcut({ key: ';', metaKey: true, shiftKey: true })).toBe(false);
        expect(isSideChatShortcut({ key: 'k', metaKey: true })).toBe(false);
    });

    it('is labelled for the platform', () => {
        expect(sideChatShortcutLabel('MacIntel')).toBe('⌘;');
        expect(sideChatShortcutLabel('Win32')).toBe('Ctrl+;');
    });
});
