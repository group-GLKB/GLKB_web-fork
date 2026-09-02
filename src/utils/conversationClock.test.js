/**
 * The sidebar orders conversations on ONE clock.
 *
 * `last_accessed_time` arrives from the API with no timezone designator — the backend writes
 * naive UTC and Pydantic serialises it verbatim — while `updateConversationMessages` dates the
 * conversation being answered with `new Date().toISOString()`, which is UTC and says so. Read
 * by `new Date()`, the first is local time and the second is UTC, so west of Greenwich every
 * server timestamp landed hours in the future and outranked the conversation that was actually
 * being answered. The reader asked a question and watched its thread stay where it was.
 *
 * Timezone-dependent bugs need a timezone to show up in, so these tests pick one at each side
 * of UTC rather than trusting whatever the machine running them happens to be set to.
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
import { updateConversationMessages } from './chatHistory';

const ORIGINAL_TZ = process.env.TZ;
afterAll(() => { process.env.TZ = ORIGINAL_TZ; });

/** `last_accessed_time` exactly as the API sends it: UTC, with nothing saying so. */
const serverStampHoursAgo = (hours) => (
    new Date(Date.now() - hours * 3600_000).toISOString().replace(/\.\d+Z$/, '')
);

const conversation = (id, updatedAt) => ({
    id,
    hid: Number(id),
    leadingTitle: `Conversation ${id}`,
    createdAt: serverStampHoursAgo(72),
    updatedAt,
    messageCount: 2,
    messages: [],
});

const ids = (result) => result.map((item) => item.id);

/* Two hours ago and three hours ago. Chosen to sit INSIDE the offset of a zone west of UTC:
   misread as local time they land in the future, which is what let them outrank a conversation
   dated now. A fixture from last week would have been beaten by `now` under either reading and
   would have passed with the bug in place. */
const listFromServer = () => ([
    conversation('1', serverStampHoursAgo(2)),
    conversation('2', serverStampHoursAgo(3)),
]);

describe.each([
    ['America/Detroit', 'west of UTC'],
    ['Asia/Shanghai', 'east of UTC'],
    ['UTC', 'at UTC'],
])('the conversation being answered, %s (%s)', (timeZone) => {
    beforeEach(() => { process.env.TZ = timeZone; });

    it('goes to the top of a list carrying the API\'s own timestamps', () => {
        const next = updateConversationMessages(
            listFromServer(),
            '2',
            [{ role: 'user', content: 'What is TP53?' }],
            { touch: true },
        );
        expect(ids(next)).toEqual(['2', '1']);
    });

    it('stays there as the answer streams in', () => {
        let next = updateConversationMessages(
            listFromServer(),
            '2',
            [{ role: 'user', content: 'What is TP53?' }],
            { touch: true },
        );
        next = updateConversationMessages(
            next,
            '2',
            [
                { role: 'user', content: 'What is TP53?' },
                { role: 'assistant', content: 'TP53 is…' },
            ],
            { touch: true },
        );
        expect(ids(next)).toEqual(['2', '1']);
    });

    it('does not disturb rows that only carry server timestamps', () => {
        const next = updateConversationMessages(listFromServer(), '2', [], { touch: false });
        expect(ids(next)).toEqual(['1', '2']);
    });
});

describe('ties', () => {
    it('keeps the order it was given when two rows share a moment', () => {
        const at = serverStampHoursAgo(1);
        const next = updateConversationMessages(
            [conversation('a', at), conversation('b', at), conversation('c', at)],
            'zzz',
            [],
        );
        // 'zzz' is not in the list, so it is prepended; the three tied rows keep their order.
        expect(ids(next).slice(1)).toEqual(['a', 'b', 'c']);
    });

    it('sorts a row with an unreadable timestamp last instead of scrambling the list', () => {
        const next = updateConversationMessages(
            [
                conversation('broken', 'not a date'),
                conversation('older', serverStampHoursAgo(5)),
                conversation('newer', serverStampHoursAgo(1)),
            ],
            'newer',
            [],
        );
        expect(ids(next)).toEqual(['newer', 'older', 'broken']);
    });
});
