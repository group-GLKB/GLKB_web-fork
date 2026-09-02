/**
 * What is needed to find an answer again after the page that asked for it is gone.
 *
 * The server does not stop when the browser does. It saves the prompt the moment a run starts
 * (`start_exchange`) and writes the answer when the agent finishes, whether or not anyone is
 * still connected. The client half of that is an address to reconnect at — the run's session
 * id, which `GET /run?session_id=` answers for a plain chat turn as well as a deep-research
 * one — and a note of which conversations were still being written.
 *
 * Both used to live in **sessionStorage**, which the browser discards when the tab closes. So
 * the one exit that really does end a run was also the one that destroyed the means of
 * recovering from it: a reader who closed the tab mid-answer came back to their question
 * sitting alone under no spinner, with nothing fetching the answer their quota had already
 * paid for. It arrived only if they happened to reload again after the server had finished.
 *
 * These records belong to the conversation, not to the tab that opened it, so they live in
 * localStorage. That also makes them shared between tabs, which is what a reader with two
 * questions in flight in two windows means by it.
 *
 * Kept deliberately small — ids and a timestamp, never message text — because it is written on
 * the hot path of starting a run and read on every mount.
 */

const SESSION_ID_KEY = 'llmSessionIds';
const RUNS_IN_FLIGHT_KEY = 'glkbRunsInFlight';

/* Long enough for the longest run the app will wait out (deep research polls for fifteen
   minutes), with room for a slow one; short enough that a mark orphaned by a crashed server
   stops claiming its conversation is busy by the next time the reader comes back. A mark is
   also reconciled against the server whenever its conversation is opened, so this is the
   backstop rather than the main defence. */
const RUN_MAX_AGE_MS = 45 * 60 * 1000;

const getStore = (which) => {
    if (typeof window === 'undefined') return null;
    try {
        return which === 'session' ? window.sessionStorage : window.localStorage;
    } catch (error) {
        // Storage can be disabled outright (private mode, an enterprise policy). Recovery is
        // an aid; nothing here may throw into the code that starts a run.
        return null;
    }
};

const readJson = (storage, key, fallback) => {
    if (!storage) return fallback;
    try {
        const raw = storage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (error) {
        return fallback;
    }
};

const writeJson = (storage, key, value) => {
    if (!storage) return;
    try {
        storage.setItem(key, JSON.stringify(value));
    } catch (error) {
        // A quota error must never interrupt the run this is recording.
    }
};

/* ── session ids ─────────────────────────────────────────────────────────────────────── */

let migrated = false;

/**
 * The conversation -> session id map, moving anything the old sessionStorage copy still holds
 * across on the way. Without the migration, upgrading mid-run would lose the address of the
 * answer being written at that moment — the exact case this module exists for.
 */
const getSessionIdMap = () => {
    const local = getStore('local');
    const map = readJson(local, SESSION_ID_KEY, {});
    if (migrated) return map;
    migrated = true;
    const legacy = readJson(getStore('session'), SESSION_ID_KEY, {});
    const legacyKeys = Object.keys(legacy);
    if (!legacyKeys.length) return map;
    // The local copy wins: it is the newer store, and a value there was written by this build.
    const merged = { ...legacy, ...map };
    writeJson(local, SESSION_ID_KEY, merged);
    return merged;
};

export const getStoredSessionId = (historyId) => {
    if (!historyId) return null;
    return getSessionIdMap()[String(historyId)] || null;
};

export const setStoredSessionId = (historyId, sessionId) => {
    if (!historyId) return;
    const map = getSessionIdMap();
    if (sessionId) {
        map[String(historyId)] = sessionId;
    } else {
        delete map[String(historyId)];
    }
    writeJson(getStore('local'), SESSION_ID_KEY, map);
};

/* ── runs in flight ──────────────────────────────────────────────────────────────────── */

const isFresh = (record) => {
    const startedAt = Number(record?.startedAt);
    return Number.isFinite(startedAt) && Date.now() - startedAt <= RUN_MAX_AGE_MS;
};

const readRuns = () => {
    const stored = readJson(getStore('local'), RUNS_IN_FLIGHT_KEY, {});
    const fresh = {};
    let dropped = false;
    Object.keys(stored).forEach((id) => {
        const record = stored[id];
        if (record && isFresh(record)) fresh[id] = record;
        else dropped = true;
    });
    if (dropped) writeJson(getStore('local'), RUNS_IN_FLIGHT_KEY, fresh);
    return fresh;
};

/**
 * Note that this conversation is being answered, and how to reconnect to it.
 *
 * Only a saved conversation is recorded. A signed-out reader's run has a session id but no
 * conversation and no server-side transcript, so there would be nothing to draw a recovered
 * answer on top of — their run is remembered by the run snapshot instead, for as long as their
 * tab lives.
 */
export const markRunInFlight = ({ conversationId, sessionId, kind = 'chat' } = {}) => {
    if (!conversationId) return;
    const runs = readRuns();
    const id = String(conversationId);
    runs[id] = {
        conversationId: id,
        // Kept even when null: the record still says "this one is working", which is what the
        // sidebar draws and what stops a second turn racing it.
        sessionId: sessionId || runs[id]?.sessionId || null,
        kind,
        startedAt: runs[id]?.startedAt ?? Date.now(),
    };
    writeJson(getStore('local'), RUNS_IN_FLIGHT_KEY, runs);
};

export const clearRunInFlight = (conversationId) => {
    if (!conversationId) return;
    const runs = readRuns();
    const id = String(conversationId);
    if (!(id in runs)) return;
    delete runs[id];
    writeJson(getStore('local'), RUNS_IN_FLIGHT_KEY, runs);
};

/** Every conversation recorded as still being answered, newest first. */
export const getRunsInFlight = () => (
    Object.values(readRuns()).sort((a, b) => (b?.startedAt ?? 0) - (a?.startedAt ?? 0))
);

export const getRunInFlight = (conversationId) => (
    conversationId ? readRuns()[String(conversationId)] || null : null
);

export { RUN_MAX_AGE_MS, RUNS_IN_FLIGHT_KEY, SESSION_ID_KEY };
