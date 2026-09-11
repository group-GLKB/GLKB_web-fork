// Presentation priority while the server list catches up, independent of the run lock.
const holds = new Map();
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());
export const getRecentPriorityIds = () => new Set(holds.keys());
export const subscribeToRecentPriority = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
export const holdRecentPriority = (conversationId, refresh) => {
    if (conversationId == null || !refresh) return;
    const id = String(conversationId);
    const token = {};
    holds.set(id, token);
    notify();
    const release = () => {
        if (holds.get(id) !== token) return;
        holds.delete(id);
        notify();
    };
    // A later refresh for the same conversation owns the hold; an older one cannot clear it.
    Promise.resolve(refresh).then(release, release);
};
