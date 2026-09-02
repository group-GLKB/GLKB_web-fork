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
import { clearRunInFlight, getRunsInFlight, markRunInFlight } from './runRecovery';

const listeners = new Set();

/** conversationId (string) -> run record. Insertion-ordered, so the last is the newest. */
const runs = new Map();

/* What was still being answered when this page last existed.
 *
 * This registry is module state, so a reload used to empty it — and everything that reads it
 * then said "nothing is running here". The sidebar lost its working dots; the restore stopped
 * trusting the conversation's locally stored turn over the server's shorter copy; and the
 * guard that keeps a second turn off a busy history id went quiet on precisely the runs it
 * exists to protect. The durable record (see runRecovery.js) is read back here so a reload
 * picks the registry up where it left off.
 *
 * These entries are a claim, not proof: the server may have finished while the page was away.
 * Opening the conversation reconciles them — the restore clears a mark whose history has come
 * back finished — and runRecovery ages them out on its own. */
getRunsInFlight().forEach((record) => {
    if (!record?.conversationId) return;
    runs.set(String(record.conversationId), {
        kind: record.kind || 'chat',
        runId: null,
        conversationId: String(record.conversationId),
        sessionId: record.sessionId || null,
        startedAt: record.startedAt || Date.now(),
        recovered: true,
    });
});

/* A run started before its conversation row exists has no conversation to be keyed on, so it
   is filed under its own stream id until the row arrives. It used to share one `__pending__`
   slot with every other such run — which was fine while only one run could exist, and stopped
   being fine when a reader could leave one answer writing and start another: the second
   overwrote the first's record, and whichever finished first took down the mark belonging to
   the one still going. `__pending__` remains only for a caller that has no id at all. */
const PENDING_KEY = '__pending__';

const provisionalKey = (key) => (key ? `run:${key}` : PENDING_KEY);
const isProvisional = (key) => key === PENDING_KEY || key.startsWith('run:');

const keyFor = (run) => (
    run?.conversationId != null ? String(run.conversationId) : provisionalKey(run?.key)
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
        if (!isProvisional(key)) ids.add(key);
    });
    return ids;
};

export const isConversationRunning = (conversationId) => (
    conversationId != null && runs.has(String(conversationId))
);

/**
 * The session id a conversation's run can be reattached at, if this registry knows one.
 *
 * The per-conversation session store is the usual source; this covers the run recovered from
 * the durable record, whose id arrived with it.
 */
export const getRunSessionId = (conversationId) => (
    conversationId != null
        ? (runs.get(String(conversationId))?.sessionId || null)
        : null
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
    // The conversation row is created after the run starts, so a run's first record is
    // provisional and this is where it acquires its real key. Without the delete the sidebar
    // would show one conversation running twice. Only a run that NAMES its provisional slot
    // may vacate one: with no key, `provisionalKey` resolves to the shared '__pending__'
    // slot, which belongs to whichever nameless run is using it — a signed-out recovery,
    // say — and deleting it here took that run's mark down mid-answer.
    if (run.conversationId != null && run.key != null) runs.delete(provisionalKey(run.key));
    const existing = runs.get(key);
    // Delete before set so insertion order tracks the most recent write, which is what
    // `getActiveRun` reports. `Map.set` on an existing key keeps its original position.
    runs.delete(key);
    const record = { startedAt: existing?.startedAt ?? Date.now(), ...run };
    runs.set(key, record);
    /* Written through so the next page load knows this conversation was being answered, and at
       which session id to pick the answer up. A provisional run has no conversation to file it
       under yet; it is recorded when `saved` gives it one. */
    if (record.conversationId != null) {
        markRunInFlight({
            conversationId: record.conversationId,
            sessionId: record.sessionId ?? existing?.sessionId ?? null,
            kind: record.kind || 'chat',
        });
    }
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
        runs.forEach((run, key) => {
            if (!isProvisional(key)) clearRunInFlight(key);
        });
        runs.clear();
        notify();
        return;
    }
    const key = String(conversationId);
    /* The durable record goes even when this registry has nothing under that key: after a
       reload the mark may exist only on disk, and the restore that finds a finished history
       is exactly the caller that needs to be able to take it down. */
    clearRunInFlight(key);
    if (!runs.delete(key)) return;
    notify();
};

/**
 * Drop the record for a run that never got a conversation id.
 *
 * `key` is the run's own stream id. Passing it matters once more than one such run can exist:
 * without it this clears whichever run happens to hold the shared slot, which may be one that
 * is still being written.
 */
export const clearPendingRun = (key) => {
    if (!runs.delete(provisionalKey(key))) return;
    notify();
};

/**
 * Bring the registry into line with what the server says is still being answered.
 *
 * A mark here can outlive its run: the page was away while the answer landed, or the record
 * was written by a tab that has since closed. And a run can exist that this tab never saw —
 * a question asked in another window, or on another device. The conversation list carries
 * `is_answering` for exactly this, so a refresh can settle both directions at once.
 *
 * Only RECOVERED marks are removed. A mark that a live request in this tab put up belongs to
 * that request, whose own `finally` takes it down: the `saved` frame arrives (and refreshes
 * this list) a moment before the stream finishes settling, so clearing on the server's word
 * would free the conversation while its own run was still writing — and let a queued follow-up
 * race it. That is the bug this registry exists to prevent.
 *
 * @param {Array<{id: *, isAnswering?: boolean, sessionId?: string, isInvestigate?: boolean}>} summaries
 */
export const reconcileRunsWithServer = (summaries) => {
    if (!Array.isArray(summaries)) return;
    let changed = false;
    summaries.forEach((summary) => {
        if (summary?.id == null) return;
        const key = String(summary.id);
        const existing = runs.get(key);
        if (summary.isAnswering) {
            if (existing) {
                // Keep the mark; top up the address if this is the first time one arrived.
                if (!existing.sessionId && summary.sessionId) {
                    existing.sessionId = summary.sessionId;
                    markRunInFlight({
                        conversationId: key,
                        sessionId: summary.sessionId,
                        kind: existing.kind || 'chat',
                    });
                }
                return;
            }
            runs.set(key, {
                kind: summary.isInvestigate ? 'investigate' : 'chat',
                runId: null,
                conversationId: key,
                sessionId: summary.sessionId || null,
                startedAt: Date.now(),
                recovered: true,
            });
            markRunInFlight({
                conversationId: key,
                sessionId: summary.sessionId || null,
                kind: summary.isInvestigate ? 'investigate' : 'chat',
            });
            changed = true;
            return;
        }
        if (existing?.recovered) {
            runs.delete(key);
            clearRunInFlight(key);
            changed = true;
        }
    });
    if (changed) notify();
};

export const subscribeToActiveRun = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
