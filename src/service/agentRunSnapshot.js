const ACTIVE_RUN_SNAPSHOT_KEY = 'llmActiveRunSnapshot';
const PROCESSING_FLAG_KEY = 'llmWasProcessing';
const SNAPSHOT_VERSION = 1;
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

        if (
            parsed?.version !== SNAPSHOT_VERSION
            || parsed?.active !== true
            || !parsed?.conversationId
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
    if (!storage || !snapshot?.conversationId) return false;

    const next = {
        ...snapshot,
        version: SNAPSHOT_VERSION,
        active: true,
        conversationId: String(snapshot.conversationId),
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
