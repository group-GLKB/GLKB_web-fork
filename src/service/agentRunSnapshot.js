/**
 * What the reader had on screen when the page went away, so a reload can put it back.
 *
 * A run does NOT need a saved conversation to be worth restoring. Both gates here used to
 * require `conversationId`, which a signed-out reader never has — `createConversation` is
 * behind `isAuthenticated` — so for a guest no snapshot was ever written, and reloading
 * mid-answer lost the question, the answer and the progress with it. Guests are a supported
 * class of user here, with their own quota; losing their work on a refresh is not acceptable.
 *
 * So the snapshot stands on its own: it carries the messages it is describing rather than
 * pointing at a conversation store that may hold nothing. `conversationId` is still recorded
 * when there is one, because a signed-in reader's stored conversation is the better source and
 * the id is what reattaches the run to it.
 */
const ACTIVE_RUN_SNAPSHOT_KEY = 'llmActiveRunSnapshot';
const PROCESSING_FLAG_KEY = 'llmWasProcessing';
// 2: `conversationId` became optional and `messages` was added. A v1 snapshot cannot restore a
// guest run and is discarded rather than half-read.
const SNAPSHOT_VERSION = 2;
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const getSessionStorage = () => {
    if (typeof window === 'undefined') return null;
    try {
        return window.sessionStorage;
    } catch (error) {
        return null;
    }
};

export const readActiveRunSnapshot = () => {
    const storage = getSessionStorage();
    if (!storage) return null;

    try {
        const raw = storage.getItem(ACTIVE_RUN_SNAPSHOT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const savedAt = Number(parsed?.savedAt);
        const isFresh = Number.isFinite(savedAt)
            && Date.now() - savedAt <= SNAPSHOT_MAX_AGE_MS;

        // A run with neither a conversation to reattach to nor messages of its own describes
        // nothing that can be put back on screen.
        const hasSomethingToRestore = Boolean(parsed?.conversationId)
            || (Array.isArray(parsed?.messages) && parsed.messages.length > 0);

        if (
            parsed?.version !== SNAPSHOT_VERSION
            || parsed?.active !== true
            || !hasSomethingToRestore
            || !isFresh
        ) {
            storage.removeItem(ACTIVE_RUN_SNAPSHOT_KEY);
            return null;
        }
        return parsed;
    } catch (error) {
        storage.removeItem(ACTIVE_RUN_SNAPSHOT_KEY);
        return null;
    }
};

export const writeActiveRunSnapshot = (snapshot) => {
    const storage = getSessionStorage();
    if (!storage) return false;
    const hasMessages = Array.isArray(snapshot?.messages) && snapshot.messages.length > 0;
    if (!snapshot?.conversationId && !hasMessages) return false;

    const next = {
        ...snapshot,
        version: SNAPSHOT_VERSION,
        active: true,
        // Null for a guest, and for the window before the row comes back from the server.
        conversationId: snapshot.conversationId ? String(snapshot.conversationId) : null,
        savedAt: Date.now(),
    };

    try {
        storage.setItem(ACTIVE_RUN_SNAPSHOT_KEY, JSON.stringify(next));
        return true;
    } catch (error) {
        // Progress snapshots are a recovery aid. A storage quota error must never interrupt
        // the live Agent request itself.
        return false;
    }
};

export const clearActiveRunSnapshot = () => {
    const storage = getSessionStorage();
    if (!storage) return;
    try {
        storage.removeItem(ACTIVE_RUN_SNAPSHOT_KEY);
    } catch (error) {
        // Storage can be disabled by the browser; finishing a run must still be harmless.
    }
};

export const shouldResumeAgentInBackground = () => {
    if (readActiveRunSnapshot()) return true;
    const storage = getSessionStorage();
    if (!storage) return false;
    try {
        // Backwards compatibility with runs started before progress snapshots existed.
        return storage.getItem(PROCESSING_FLAG_KEY) === 'true';
    } catch (error) {
        return false;
    }
};

export { ACTIVE_RUN_SNAPSHOT_KEY };
