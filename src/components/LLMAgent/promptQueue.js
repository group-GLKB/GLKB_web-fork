/**
 * Which thread a queued follow-up belongs to.
 *
 * Sending mid-run is not an option — the agent is mid-stream and a second turn on the same
 * conversation would race the first — so a follow-up written during an answer is held and sent
 * when that answer finishes. The question is where it goes when it is finally sent.
 *
 * It used to go wherever the reader happened to be. The queue held only the text, and the
 * release submitted it like any other message, into the conversation that was open at that
 * moment. So queueing a follow-up and then opening another conversation posted it as a
 * follow-up to THAT one — under someone else's question, with someone else's history behind
 * it — and the pending bubble showed up there too, in a thread it was never meant for.
 *
 * So an entry carries its thread. It is drawn only under that thread and released only into
 * it, whatever is on screen by then; the run that carries it is an ordinary background run,
 * which the rest of the chat already supports.
 *
 * An entry queued before its conversation row exists has no thread to name yet. It belongs to
 * whatever is open, which is where it was written — the row is one round trip away and the
 * reader is still looking at it.
 *
 * Its own module, with no imports, so the rule can be tested without pulling the whole app in.
 */

const sameId = (a, b) => (
    a != null && b != null && String(a) === String(b)
);

/**
 * The conversation to file a newly queued follow-up under.
 *
 * The run's own conversation first: queueing is only offered while the reader is looking at
 * the conversation that is answering, and that run may already own a row the viewport has not
 * been switched to yet.
 */
export const queuedPromptOwner = (runningConversationId, activeConversationId) => (
    runningConversationId ?? activeConversationId ?? null
);

/** The entries that belong on screen while `activeConversationId` is the thread being shown. */
export const promptsForConversation = (queue, activeConversationId) => (
    (Array.isArray(queue) ? queue : []).filter((item) => (
        item?.conversationId == null || sameId(item.conversationId, activeConversationId)
    ))
);

/**
 * Where a released entry goes.
 *
 * `onScreen` false means the turn continues a thread the reader has left, so it also needs its
 * own starting history: the live `chatHistory` is the conversation being looked at, not the one
 * this question follows on from.
 */
export const releaseTargetFor = (entry, activeConversationId) => {
    const conversationId = entry?.conversationId ?? null;
    return {
        conversationId,
        onScreen: conversationId == null || sameId(conversationId, activeConversationId),
    };
};

/**
 * What survives starting a new chat.
 *
 * The entries with no thread of their own were written against the chat being cleared and go
 * with it. One queued against a named conversation does not: that conversation is still being
 * written and will still take its follow-up.
 */
export const promptsSurvivingReset = (queue) => (
    (Array.isArray(queue) ? queue : []).filter((item) => item?.conversationId != null)
);
