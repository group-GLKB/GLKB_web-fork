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
    claimQueuedPrompts,
    nextReleasableEntry,
    promptsForConversation,
    promptsSurvivingReset,
    queuedPromptOwner,
    releaseTargetFor,
} from './promptQueue';

const entry = (id, conversationId, runKey = null) => ({
    id,
    text: `q${id}`,
    conversationId,
    runKey,
});

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
        expect(promptsForConversation(queue, '42').map((i) => i.id)).toEqual(['a', 'd']);
    });

    it('does not leak one thread’s pending question into another', () => {
        expect(promptsForConversation(queue, '7').map((i) => i.id)).toEqual(['b']);
    });

    /* An unfiled entry belongs to the thread that has no name yet. Showing it under every
       conversation — the old "null matches anything" — put a question queued moments before
       its row arrived into whatever old conversation the reader opened next. */
    it('does not show an unfiled entry under a named conversation', () => {
        expect(promptsForConversation([entry('c', null)], '42')).toEqual([]);
    });

    it('keeps an unfiled entry visible wherever it was written', () => {
        expect(promptsForConversation(queue, null).map((i) => i.id)).toEqual(['c']);
    });

    it('shows only the nameless queue owned by the run on screen', () => {
        const pending = [entry('a', null, 'run-a'), entry('b', null, 'run-b')];
        expect(promptsForConversation(pending, null, 'run-a').map((i) => i.id)).toEqual(['a']);
        expect(promptsForConversation(pending, null, 'run-b').map((i) => i.id)).toEqual(['b']);
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

    it('holds an unfiled entry off screen while a named conversation is open', () => {
        expect(releaseTargetFor(entry('a', null), '7'))
            .toEqual({ conversationId: null, onScreen: false });
    });

    it('keeps an unfiled entry on the nameless screen it was written on', () => {
        expect(releaseTargetFor(entry('a', null), null))
            .toEqual({ conversationId: null, onScreen: true });
    });

    it('does not treat another nameless run as the same screen', () => {
        expect(releaseTargetFor(entry('a', null, 'run-a'), null, 'run-b'))
            .toEqual({ conversationId: null, onScreen: false });
        expect(releaseTargetFor(entry('a', null, 'run-a'), null, 'run-a'))
            .toEqual({ conversationId: null, onScreen: true });
    });

    it('treats a missing entry as unfiled rather than throwing', () => {
        expect(releaseTargetFor(undefined, null))
            .toEqual({ conversationId: null, onScreen: true });
    });
});

describe('when a new conversation receives its saved id', () => {
    it('claims only the queue owned by that run', () => {
        const queue = [
            entry('a', null, 'run-a'),
            entry('b', null, 'run-b'),
            entry('c', 'existing'),
        ];
        const claimed = claimQueuedPrompts(queue, 'run-a', '42');
        expect(claimed.map((item) => [item.id, item.conversationId])).toEqual([
            ['a', '42'],
            ['b', null],
            ['c', 'existing'],
        ]);
    });

    it('keeps all follow-ups from the same run together', () => {
        const queue = [entry('a', null, 'run-a'), entry('b', null, 'run-a')];
        expect(claimQueuedPrompts(queue, 'run-a', '42').map((item) => item.conversationId))
            .toEqual(['42', '42']);
    });
});

describe('starting a new chat', () => {
    it('drops what was waiting on the chat being left', () => {
        const queue = [entry('a', '42'), entry('b', null)];
        expect(promptsSurvivingReset(queue).map((i) => i.id)).toEqual(['a']);
    });

    it('drops only the provisional queue belonging to the chat being left', () => {
        const queue = [entry('a', null, 'run-a'), entry('b', null, 'run-b')];
        expect(promptsSurvivingReset(queue, 'run-a').map((i) => i.id)).toEqual(['b']);
    });

    it('keeps a follow-up owed to a conversation that is still being written', () => {
        expect(promptsSurvivingReset([entry('a', '42')])).toHaveLength(1);
    });

    it('survives a queue that is missing', () => {
        expect(promptsSurvivingReset(undefined)).toEqual([]);
    });
});

describe('which entry is released next', () => {
    const running = (...ids) => (id) => ids.map(String).includes(String(id));

    it('waits while its own conversation is still answering', () => {
        expect(nextReleasableEntry([entry('a', '42')], {
            activeConversationId: '7',
            isConversationRunning: running('42'),
        })).toBeNull();
    });

    it('releases a follow-up to a finished thread the reader has left', () => {
        const next = nextReleasableEntry([entry('a', '42')], {
            activeConversationId: '7',
            isConversationRunning: running(),
        });
        expect(next?.id).toBe('a');
    });

    /* The old release was head-of-line: one entry whose conversation was still busy held
       back every entry behind it, including those whose conversations were long finished. */
    it('lets a free conversation overtake a busy one', () => {
        const next = nextReleasableEntry([entry('a', '42'), entry('b', '7')], {
            activeConversationId: null,
            isConversationRunning: running('42'),
        });
        expect(next?.id).toBe('b');
    });

    it('never reorders two follow-ups to the same conversation', () => {
        const next = nextReleasableEntry([entry('a', '42'), entry('b', '42')], {
            activeConversationId: '7',
            isConversationRunning: running(),
        });
        expect(next?.id).toBe('a');
    });

    it('holds an on-screen entry while the view is busy', () => {
        expect(nextReleasableEntry([entry('a', '42')], {
            activeConversationId: '42',
            isConversationRunning: running(),
            viewBusy: true,
        })).toBeNull();
    });

    it('releases an off-screen entry even while the view is busy', () => {
        const next = nextReleasableEntry([entry('a', '42')], {
            activeConversationId: '7',
            isConversationRunning: running(),
            viewBusy: true,
        });
        expect(next?.id).toBe('a');
    });

    it('holds an unfiled entry until the nameless screen is idle again', () => {
        expect(nextReleasableEntry([entry('a', null)], {
            activeConversationId: '7',
            isConversationRunning: running(),
        })).toBeNull();
        expect(nextReleasableEntry([entry('a', null)], {
            activeConversationId: null,
            isConversationRunning: running(),
            viewBusy: true,
        })).toBeNull();
        const next = nextReleasableEntry([entry('a', null)], {
            activeConversationId: null,
            isConversationRunning: running(),
        });
        expect(next?.id).toBe('a');
    });

    it('does not release a queue owned by another nameless run', () => {
        const queue = [entry('a', null, 'run-a'), entry('b', null, 'run-b')];
        const next = nextReleasableEntry(queue, {
            activeConversationId: null,
            activeRunKey: 'run-b',
            isConversationRunning: running(),
        });
        expect(next?.id).toBe('b');
    });

    /* A deep-research follow-up can stop to ask the reader a clarifying question; run in the
       background there is nobody to show it to, and the run would pause forever. */
    it('holds an entry that needs the reader until its conversation is on screen', () => {
        const needsScreen = (item) => item?.searchOptions?.investigateEnabled === true;
        const investigate = { ...entry('a', '42'), searchOptions: { investigateEnabled: true } };
        expect(nextReleasableEntry([investigate], {
            activeConversationId: '7',
            isConversationRunning: running(),
            requiresScreen: needsScreen,
        })).toBeNull();
        const next = nextReleasableEntry([investigate], {
            activeConversationId: '42',
            isConversationRunning: running(),
            requiresScreen: needsScreen,
        });
        expect(next?.id).toBe('a');
    });

    it('still releases an ordinary chat follow-up off screen', () => {
        const needsScreen = (item) => item?.searchOptions?.investigateEnabled === true;
        const next = nextReleasableEntry([entry('a', '42')], {
            activeConversationId: '7',
            isConversationRunning: running(),
            requiresScreen: needsScreen,
        });
        expect(next?.id).toBe('a');
    });

    it('survives a queue that is missing', () => {
        expect(nextReleasableEntry(undefined, {})).toBeNull();
        expect(nextReleasableEntry([entry('a', '42')])).toBeTruthy();
    });
});
