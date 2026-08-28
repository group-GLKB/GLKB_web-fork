/**
 * Which conversations are still working.
 *
 * The Agent controller remains mounted after its first visit, so normal app
 * navigation no longer interrupts its request or live state. The run also does
 * not belong to the visible page: the server keeps going, plain answers are
 * saved against their history ids, and investigate runs can be re-read by run id.
 *
 * This registry outlives the visible route. It exists so that:
 *   - the page can be left without a warning, because nothing is lost;
 *   - every conversation that is working can say so, wherever it is listed;
 *   - closing the tab still warns, wherever the reader happens to be, because
 *     that does end the run.
 *
 * Module scope rather than context: it is written from deep inside the chat and
 * observed by both the layout and entry surfaces without owning the Agent UI.
 *
 * It holds MANY runs, keyed by conversation. It used to hold one, and every entry
 * point stayed locked until that one finished — so a reader with a question in mind
 * had to wait out the answer they had already stopped reading. A question asked in a
 * new conversation does not race the one in flight: they are different sessions with
 * different history ids, and the backend locks per history id, not per user. What is
 * still refused is a second turn in the SAME conversation, which would race its own
 * predecessor; that one is queued instead.
 */
const listeners = new Set();

/** conversationId (string) -> run record. Insertion-ordered, so the last is the newest. */
const runs = new Map();

// A run started before its conversation row exists has no id to key on. It gets this one,
// and `setActiveRun` re-keys it as soon as the row comes back from the server.
const PENDING_KEY = '__pending__';

const keyFor = (run) => (
    run?.conversationId != null ? String(run.conversationId) : PENDING_KEY
);

const notify = () => {
    // Existing listeners are written against a single record; the newest run is the one a
    // single-run reader means. `getRunningConversationIds` is how a list shows all of them.
    const current = getActiveRun();
    listeners.forEach((listener) => {
        try { listener(current); } catch (error) { /* one bad listener must not stop the rest */ }
    });
};

/** The most recently started run, or null. */
export const getActiveRun = () => {
    let latest = null;
    runs.forEach((run) => { latest = run; });
    return latest;
};

export const isRunActive = () => runs.size > 0;

/** Every conversation with a run in flight, as strings. Excludes a run with no id yet. */
export const getRunningConversationIds = () => {
    const ids = new Set();
    runs.forEach((run, key) => {
        if (key !== PENDING_KEY) ids.add(key);
    });
    return ids;
};

export const isConversationRunning = (conversationId) => (
    conversationId != null && runs.has(String(conversationId))
);

/**
 * Record a run, or move the one that had no conversation id yet onto the id it just got.
 *
 * `kind` is 'investigate' or 'chat'; `runId` is only present for the former.
 */
export const setActiveRun = (run) => {
    if (!run) {
        // Kept for the old single-run call: `setActiveRun(null)` meant "nothing is running".
        runs.clear();
        notify();
        return;
    }
    const key = keyFor(run);
    // The conversation row is created after the run starts, so the first record is keyed
    // PENDING and this is where it acquires its real key. Without the delete the sidebar
    // would show one conversation running twice.
    if (key !== PENDING_KEY) runs.delete(PENDING_KEY);
    const existing = runs.get(key);
    runs.set(key, { startedAt: existing?.startedAt ?? Date.now(), ...run });
    notify();
};

/**
 * Forget one conversation's run, or every run when called with nothing.
 *
 * The no-argument form is the old signature and still means "nothing is running at all";
 * it is what a hard reset uses.
 */
export const clearActiveRun = (conversationId) => {
    if (conversationId == null) {
        if (!runs.size) return;
        runs.clear();
        notify();
        return;
    }
    const key = String(conversationId);
    if (!runs.delete(key)) return;
    notify();
};

/** Drop the record for a run that never got a conversation id. */
export const clearPendingRun = () => {
    if (!runs.delete(PENDING_KEY)) return;
    notify();
};

export const subscribeToActiveRun = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
