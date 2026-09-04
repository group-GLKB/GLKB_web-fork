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

/* A conversation may not have a history id yet, but it already has a unique stream/session
   key. Treat two missing keys as the one legacy nameless thread; otherwise they must match.
   Without this second coordinate every simultaneously-created conversation looked like the
   same `conversationId: null` thread until its Saved frame arrived. */
const sameRunKey = (a, b) => (
    a == null ? b == null : sameId(a, b)
);

const isEntryOnScreen = (entry, activeConversationId, activeRunKey) => {
    const conversationId = entry?.conversationId ?? null;
    if (conversationId != null) return sameId(conversationId, activeConversationId);
    return activeConversationId == null && sameRunKey(entry?.runKey, activeRunKey);
};

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

/** The entries that belong on screen while `activeConversationId` is the thread being shown.
 *
 * A nameless entry belongs to the thread that has no name — the one being written before its
 * row exists, or a guest's only thread. It used to be shown under EVERY conversation ("no
 * conversation id" read as "matches anything"), so a question queued moments before its row
 * arrived appeared to be pending in whatever old conversation the reader opened next. */
export const promptsForConversation = (queue, activeConversationId, activeRunKey = null) => (
    (Array.isArray(queue) ? queue : []).filter((item) => (
        isEntryOnScreen(item, activeConversationId, activeRunKey)
    ))
);

/** Move only one provisional run's queue onto the history id delivered by its Saved frame.
 *
 * Several new conversations can be streaming before any has a history id. Mapping every null
 * entry here lets whichever Saved frame arrives first steal the other conversations' bubbles
 * and later submit them with the wrong history. */
export const claimQueuedPrompts = (queue, runKey, conversationId) => {
    const entries = Array.isArray(queue) ? queue : [];
    if (conversationId == null) return entries;
    return entries.map((item) => (
        item?.conversationId == null && sameRunKey(item?.runKey, runKey)
            ? { ...item, conversationId: String(conversationId), runKey: null }
            : item
    ));
};

/**
 * Where a released entry goes.
 *
 * `onScreen` false means the turn continues a thread the reader has left, so it also needs its
 * own starting history: the live `chatHistory` is the conversation being looked at, not the one
 * this question follows on from. A nameless entry is on screen only while the screen shows the
 * nameless thread — `nextReleasableEntry` holds it back otherwise.
 */
export const releaseTargetFor = (entry, activeConversationId, activeRunKey = null) => {
    const conversationId = entry?.conversationId ?? null;
    return {
        conversationId,
        onScreen: isEntryOnScreen(entry, activeConversationId, activeRunKey),
    };
};

/**
 * The first entry that may be released right now, or null.
 *
 * An entry waits while its own conversation is still answering — a second turn on one history
 * id would race the first, which is the reason the queue exists. An entry for the thread on
 * screen additionally waits for the view to be idle, because releasing it paints into that
 * view. An entry for a thread the reader has left needs neither: it rides a background run
 * that the view never sees.
 *
 * Entries for the same conversation keep their order, because the scan always takes the
 * earliest one and every entry for a given conversation waits on the same conditions. Entries
 * for different conversations may overtake each other; their turns are independent.
 */
export const nextReleasableEntry = (queue, {
    activeConversationId = null,
    activeRunKey = null,
    isConversationRunning = () => false,
    requiresScreen = () => false,
    viewBusy = false,
} = {}) => {
    const entries = Array.isArray(queue) ? queue : [];
    for (const entry of entries) {
        const target = entry?.conversationId ?? null;
        if (target == null) {
            // The nameless thread: releasable only where it was written, when that screen is idle.
            if (isEntryOnScreen(entry, activeConversationId, activeRunKey) && !viewBusy) {
                return entry;
            }
            continue;
        }
        if (isConversationRunning(target)) continue;
        const onScreen = sameId(target, activeConversationId);
        /* Some turns cannot run unwatched. A deep-research follow-up can stop to ask the
           reader a clarifying question, and a background run has no one to show it to — the
           run would simply pause forever. Such an entry waits, visibly queued in its own
           conversation, until the reader is back there to answer. */
        if (!onScreen && requiresScreen(entry)) continue;
        if (onScreen && viewBusy) continue;
        return entry;
    }
    return null;
};

/**
 * What survives starting a new chat.
 *
 * The provisional entries owned by the run being cleared go with it. Other nameless runs may
 * exist concurrently and keep their own queues; named conversations always survive because
 * they are still being written and will still take their follow-ups.
 */
export const promptsSurvivingReset = (queue, departingRunKey = null) => (
    (Array.isArray(queue) ? queue : []).filter((item) => (
        item?.conversationId != null || !sameRunKey(item?.runKey, departingRunKey)
    ))
);
