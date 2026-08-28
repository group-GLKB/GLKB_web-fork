/**
 * Which conversation, if any, is still working.
 *
 * The Agent controller remains mounted after its first visit, so normal app
 * navigation no longer interrupts its request or live state. The run also does
 * not belong to the visible page: the server keeps going, plain answers are
 * saved against their history ids, and investigate runs can be re-read by run id.
 *
 * This registry outlives the visible route. It exists so that:
 *   - the page can be left without a warning, because nothing is lost;
 *   - every Agent entry point can stay locked until that one run finishes;
 *   - closing the tab still warns, wherever the reader happens to be, because
 *     that does end the run.
 *
 * Module scope rather than context: it is written from deep inside the chat and
 * observed by both the layout and entry surfaces without owning the Agent UI.
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
