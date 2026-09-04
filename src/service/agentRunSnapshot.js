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
 *
 * ONE PER CONVERSATION, not one per tab.
 *
 * There used to be a single slot, written by whichever run the view was following. That was
 * fine while only one run could exist. It stopped being fine once a reader could leave one
 * answer writing and start another: switching conversations takes the foreground away, the
 * effect that maintains this sees `isProcessing` go false and cleared the slot — so the
 * partial answer and the Investigate progress of the run that was STILL GOING were thrown
 * away, and coming back to it showed a bare question under a spinner with nothing behind it.
 * Keyed by conversation, each run keeps its own and a second question costs the first nothing.
 *
 * Still sessionStorage, deliberately. This is presentation state — what THIS tab had on
 * screen — and it is the right thing to lose when the tab closes. What must outlive the tab is
 * the fact that a run exists and the address to collect it at, and that lives in
 * service/runRecovery.js and in the conversation's own history row.
 */
const ACTIVE_RUN_SNAPSHOT_KEY = 'llmActiveRunSnapshots';
/* The single-slot key this replaced. Read once on the way past so a reload that happens across
   the upgrade still finds the run it was in the middle of. */
const LEGACY_SNAPSHOT_KEY = 'llmActiveRunSnapshot';
const PROCESSING_FLAG_KEY = 'llmWasProcessing';
// 2: `conversationId` became optional and `messages` was added. A v1 snapshot cannot restore a
// guest run and is discarded rather than half-read.
const SNAPSHOT_VERSION = 2;
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/* Snapshots carry the whole transcript and every progress frame, so a reader who leaves a
   dozen conversations half-answered could otherwise fill the tab's storage quota. The oldest
   go; the newest are the ones anybody is still waiting on. */
const MAX_SNAPSHOTS = 6;

/* The slot a run files under.
 *
 * A run with no conversation of its own is a guest's, and a browser has one of those at a
 * time. A signed-in run passes through the same shape for the length of the
 * `createConversation` round trip, though, and its write into this slot was never cleaned up
 * — so a guest slot could hold a stranger's transcript, and `readActiveRunSnapshot()` (the
 * newest across all slots) could hand it to a mount that had no business seeing it. Whoever
 * writes here last owns it; `releaseGuestSlot` is how a run hands it back on acquiring an id. */
const GUEST_SLOT = '__guest__';
const slotFor = (conversationId) => (conversationId ? String(conversationId) : GUEST_SLOT);

/* Which snapshot is the newest, when two were written in the same millisecond — which the
   throttled writer does whenever two runs tick together. `savedAt` alone leaves that a tie, and
   a tie resolved by object key order is not an order at all. Seeded from what is already
   stored so it keeps counting across a reload. */
let writeSeq = 0;
const nextSeq = () => {
    writeSeq += 1;
    return writeSeq;
};

const getSessionStorage = () => {
    if (typeof window === 'undefined') return null;
    try {
        return window.sessionStorage;
    } catch (error) {
        return null;
    }
};

const isRestorable = (snapshot) => {
    const savedAt = Number(snapshot?.savedAt);
    const isFresh = Number.isFinite(savedAt) && Date.now() - savedAt <= SNAPSHOT_MAX_AGE_MS;
    // A run with neither a conversation to reattach to nor messages of its own describes
    // nothing that can be put back on screen.
    const hasSomethingToRestore = Boolean(snapshot?.conversationId)
        || (Array.isArray(snapshot?.messages) && snapshot.messages.length > 0);
    return snapshot?.version === SNAPSHOT_VERSION
        && snapshot?.active === true
        && hasSomethingToRestore
        && isFresh;
};

/** Every stored snapshot that is still worth restoring, pruning the rest as it goes. */
const readAll = () => {
    const storage = getSessionStorage();
    if (!storage) return {};

    let stored = {};
    try {
        const raw = storage.getItem(ACTIVE_RUN_SNAPSHOT_KEY);
        stored = raw ? JSON.parse(raw) : {};
        if (!stored || typeof stored !== 'object' || Array.isArray(stored)) stored = {};
    } catch (error) {
        stored = {};
        try { storage.removeItem(ACTIVE_RUN_SNAPSHOT_KEY); } catch (e) { /* nothing to do */ }
    }

    /* The old single slot, folded in under its own conversation and then retired.
    
       Written to the new key BEFORE the old one is removed, and persisted unconditionally.
       It used to be removed first and written back only `if (pruned)` — which is false on a
       fresh upgrade, when there is nothing stale to prune — so the migrated run was handed to
       whichever caller happened to read first and then existed nowhere. `PersistentAgentSurface`
       calls `shouldResumeAgentInBackground()` during render and keeps only the boolean, so on a
       non-chat page that first reader threw the run away before the chat component ever asked. */
    let migrated = false;
    try {
        const legacyRaw = storage.getItem(LEGACY_SNAPSHOT_KEY);
        if (legacyRaw) {
            const legacy = JSON.parse(legacyRaw);
            const slot = slotFor(legacy?.conversationId);
            if (isRestorable(legacy) && !stored[slot]) {
                stored[slot] = legacy;
                migrated = true;
            }
        }
    } catch (error) {
        migrated = false;
    }

    const live = {};
    let pruned = false;
    Object.keys(stored).forEach((slot) => {
        if (isRestorable(stored[slot])) live[slot] = stored[slot];
        else pruned = true;
    });
    if (pruned || migrated) writeAll(live);
    if (migrated || storage.getItem(LEGACY_SNAPSHOT_KEY)) {
        // Only once the new copy is safely stored.
        try { storage.removeItem(LEGACY_SNAPSHOT_KEY); } catch (e) { /* nothing to do */ }
    }
    return live;
};

function writeAll(snapshots) {
    const storage = getSessionStorage();
    if (!storage) return false;
    try {
        storage.setItem(ACTIVE_RUN_SNAPSHOT_KEY, JSON.stringify(snapshots));
        return true;
    } catch (error) {
        // Progress snapshots are a recovery aid. A storage quota error must never interrupt
        // the live Agent request itself.
        return false;
    }
}

const isNewer = (a, b) => (
    (a?.savedAt ?? 0) !== (b?.savedAt ?? 0)
        ? (a?.savedAt ?? 0) > (b?.savedAt ?? 0)
        : (a?.seq ?? 0) > (b?.seq ?? 0)
);

const newestOf = (snapshots) => {
    let newest = null;
    Object.values(snapshots).forEach((snapshot) => {
        if (!newest || isNewer(snapshot, newest)) newest = snapshot;
    });
    return newest;
};

/**
 * The snapshot a mount should restore from when it does not yet know which conversation it is
 * showing — the newest, which is the run the reader was last watching.
 */
export const readActiveRunSnapshot = () => newestOf(readAll());

/** This conversation's own snapshot, or null. */
export const readActiveRunSnapshotFor = (conversationId) => (
    readAll()[slotFor(conversationId)] || null
);

/** Every snapshot, newest first. */
export const readAllActiveRunSnapshots = () => (
    Object.values(readAll()).sort(
        (a, b) => ((b?.savedAt ?? 0) - (a?.savedAt ?? 0)) || ((b?.seq ?? 0) - (a?.seq ?? 0)),
    )
);

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

    const snapshots = readAll();
    // Seeded from storage so the counter keeps rising across a reload rather than restarting
    // below snapshots that are already there.
    Object.values(snapshots).forEach((existing) => {
        writeSeq = Math.max(writeSeq, Number(existing?.seq) || 0);
    });
    next.seq = nextSeq();
    snapshots[slotFor(next.conversationId)] = next;

    const slots = Object.keys(snapshots);
    if (slots.length > MAX_SNAPSHOTS) {
        slots
            .sort((a, b) => (
                ((snapshots[a]?.savedAt ?? 0) - (snapshots[b]?.savedAt ?? 0))
                || ((snapshots[a]?.seq ?? 0) - (snapshots[b]?.seq ?? 0))
            ))
            .slice(0, slots.length - MAX_SNAPSHOTS)
            .forEach((slot) => { delete snapshots[slot]; });
    }
    return writeAll(snapshots);
};

/**
 * Forget one run's snapshot, or every one when called with nothing.
 *
 * The no-argument form is what a hard reset uses. Passing an id matters now that more than one
 * run can be in flight: clearing the lot when one of them finishes takes down the record of
 * the others, which are still being written.
 */
/**
 * Hand back the no-conversation slot, for a run that has just been given an id.
 *
 * Called when a snapshot moves from the guest slot to a real one, so the interim copy does
 * not linger as the newest snapshot in the store.
 */
export const releaseGuestSlot = () => {
    const snapshots = readAll();
    if (!(GUEST_SLOT in snapshots)) return;
    delete snapshots[GUEST_SLOT];
    writeAll(snapshots);
};

export const clearActiveRunSnapshot = (conversationId) => {
    const storage = getSessionStorage();
    if (!storage) return;
    if (conversationId === undefined) {
        try {
            storage.removeItem(ACTIVE_RUN_SNAPSHOT_KEY);
            storage.removeItem(LEGACY_SNAPSHOT_KEY);
        } catch (error) {
            // Storage can be disabled by the browser; finishing a run must still be harmless.
        }
        return;
    }
    const snapshots = readAll();
    const slot = slotFor(conversationId);
    if (!(slot in snapshots)) return;
    delete snapshots[slot];
    writeAll(snapshots);
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

export { ACTIVE_RUN_SNAPSHOT_KEY, LEGACY_SNAPSHOT_KEY };
