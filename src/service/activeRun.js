/**
 * Which conversation, if any, is still working.
 *
 * The chat lives under a route, so navigating to Library unmounts it. The run
 * itself does not belong to that component — the server keeps going, the answer
 * is saved against its history id, and an investigate run can be re-read by its
 * run id. What the component used to do was abort the request on unmount, which
 * threw the run away for no reason other than the reader changing page.
 *
 * This registry outlives the route. It exists so that:
 *   - the page can be left without a warning, because nothing is lost;
 *   - closing the tab still warns, wherever the reader happens to be, because
 *     that does end the run.
 *
 * Module scope rather than context: the value is read from an event handler in
 * the layout and written from deep inside the chat, and nothing renders from it.
 */
const listeners = new Set();

let active = null;

export const getActiveRun = () => active;

export const isRunActive = () => Boolean(active);

/** `kind` is 'investigate' or 'chat'; `runId` is only present for the former. */
export const setActiveRun = (run) => {
    active = run ? { startedAt: Date.now(), ...run } : null;
    listeners.forEach((listener) => {
        try { listener(active); } catch (error) { /* one bad listener must not stop the rest */ }
    });
};

export const clearActiveRun = () => setActiveRun(null);

export const subscribeToActiveRun = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
