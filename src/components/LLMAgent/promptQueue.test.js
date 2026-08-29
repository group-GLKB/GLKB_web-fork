/**
 * A queued follow-up belongs to the thread it was written against.
 *
 * The regression these pin: the queue held only the text, so a question queued during one
 * answer was released into whatever conversation was open by the time the queue drained. Queue
 * something, open another conversation, and it was posted there — as a follow-up to a question
 * it had nothing to do with, with that thread's history behind it — and the pending bubble was
 * drawn there too, in the wrong conversation, on the way.
 */
import {
    promptsForConversation,
    promptsSurvivingReset,
    queuedPromptOwner,
    releaseTargetFor,
} from './promptQueue';

const entry = (id, conversationId) => ({ id, text: `q${id}`, conversationId });

describe('filing a follow-up under its thread', () => {
    it('uses the conversation that owns the run', () => {
        expect(queuedPromptOwner('42', '42')).toBe('42');
    });

    it('prefers the run to the viewport, which may not have caught up yet', () => {
        expect(queuedPromptOwner('42', '7')).toBe('42');
    });

    it('falls back to what is on screen before the run has a row', () => {
        expect(queuedPromptOwner(null, '7')).toBe('7');
    });

    it('leaves it unfiled when neither exists yet', () => {
        expect(queuedPromptOwner(null, null)).toBeNull();
        expect(queuedPromptOwner(undefined, undefined)).toBeNull();
    });
});

describe('which pending bubbles are on screen', () => {
    const queue = [entry('a', '42'), entry('b', '7'), entry('c', null), entry('d', '42')];

    it('shows only the ones waiting on this thread', () => {
        expect(promptsForConversation(queue, '42').map((i) => i.id)).toEqual(['a', 'c', 'd']);
    });

    it('does not leak one thread’s pending question into another', () => {
        expect(promptsForConversation(queue, '7').map((i) => i.id)).toEqual(['b', 'c']);
    });

    it('keeps an unfiled entry visible wherever it was written', () => {
        expect(promptsForConversation(queue, null).map((i) => i.id)).toEqual(['c']);
    });

    it('matches a numeric row id against its string form', () => {
        expect(promptsForConversation([entry('a', 42)], '42').map((i) => i.id)).toEqual(['a']);
    });

    it('survives a queue that is missing or malformed', () => {
        expect(promptsForConversation(undefined, '42')).toEqual([]);
        expect(promptsForConversation(null, '42')).toEqual([]);
    });
});

describe('where a released follow-up goes', () => {
    it('back to its own thread, and says it needs that thread’s history', () => {
        expect(releaseTargetFor(entry('a', '42'), '7'))
            .toEqual({ conversationId: '42', onScreen: false });
    });

    it('to the thread on screen when that is the same one', () => {
        expect(releaseTargetFor(entry('a', '42'), '42'))
            .toEqual({ conversationId: '42', onScreen: true });
    });

    it('to whatever is open when it was never filed', () => {
        expect(releaseTargetFor(entry('a', null), '7'))
            .toEqual({ conversationId: null, onScreen: true });
    });

    it('treats a missing entry as unfiled rather than throwing', () => {
        expect(releaseTargetFor(undefined, '7'))
            .toEqual({ conversationId: null, onScreen: true });
    });
});

describe('starting a new chat', () => {
    it('drops what was waiting on the chat being left', () => {
        const queue = [entry('a', '42'), entry('b', null)];
        expect(promptsSurvivingReset(queue).map((i) => i.id)).toEqual(['a']);
    });

    it('keeps a follow-up owed to a conversation that is still being written', () => {
        expect(promptsSurvivingReset([entry('a', '42')])).toHaveLength(1);
    });

    it('survives a queue that is missing', () => {
        expect(promptsSurvivingReset(undefined)).toEqual([]);
    });
});
