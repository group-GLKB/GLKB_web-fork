/**
 * How hard the agent works on the next question.
 *
 * The levels are NOT written down here. The agent owns them (`glkb-agent/service/effort.py`)
 * and serves them beside the models on `GET /new-llm-agent/models` as `efforts`, so the
 * composer reads one catalogue for both pickers. A deployment whose agent predates the field
 * sends no `efforts` at all — and then no level is offered, which is the right answer: a Quick
 * chip that the request path would ignore is a promise the product cannot keep.
 *
 * Today one level changes anything: `quick` — seconds, Luna, the GLKB tools only, at most two
 * rounds of tool calls. `standard` is the turn as it always ran, and is what an absent field
 * means, so the preference stores '' for it rather than the word.
 *
 * A level may FIX its model (Quick runs on Luna whatever the picker showed). The composer reads
 * `fixedModelFor` to lock the picker onto that id while the level is on, and to omit `model`
 * from the request — the agent refuses a conflicting model with a 400 rather than quietly
 * substituting, so the client must not send one.
 *
 * The choice persists in localStorage exactly as the model choice does (service/models.js):
 * it outlasts a session, and `subscribe` keeps the two composers and every tab in step.
 */

export const CHAT_EFFORT_KEY = 'glkb_chat_effort';

const CHANGE_EVENT = 'glkb-chat-effort-change';

export const EFFORT_STANDARD = 'standard';
export const EFFORT_QUICK = 'quick';

/** What the reader last chose, or '' for standard. */
export const getEffortPref = () => {
    try {
        const stored = localStorage.getItem(CHAT_EFFORT_KEY);
        const value = typeof stored === 'string' ? stored.trim() : '';
        // Standard is the absence of a choice; an old row that spelled it out reads the same.
        return value === EFFORT_STANDARD ? '' : value;
    } catch (error) {
        return '';
    }
};

/**
 * Remember a level. Passing '', null or 'standard' clears it: the request then carries no
 * `effort` at all, which the agent reads as standard.
 */
export const setEffortPref = (effortId) => {
    const raw = typeof effortId === 'string' ? effortId.trim() : '';
    const value = raw === EFFORT_STANDARD ? '' : raw;
    try {
        if (value) {
            localStorage.setItem(CHAT_EFFORT_KEY, value);
        } else {
            localStorage.removeItem(CHAT_EFFORT_KEY);
        }
    } catch (error) {
        /* private mode: the choice still holds for this page's lifetime */
    }
    try {
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { effort: value } }));
    } catch (error) {
        /* no window: nothing is listening anyway */
    }
};

/** Fires on our own writes and on another tab's. */
export const subscribeToEffortPref = (listener) => {
    const onLocal = () => listener(getEffortPref());
    const onStorage = (event) => {
        if (!event.key || event.key === CHAT_EFFORT_KEY) listener(getEffortPref());
    };
    window.addEventListener(CHANGE_EVENT, onLocal);
    window.addEventListener('storage', onStorage);
    return () => {
        window.removeEventListener(CHANGE_EVENT, onLocal);
        window.removeEventListener('storage', onStorage);
    };
};

/**
 * The levels a pipeline may run. A row with no `pipelines` is treated as eligible
 * everywhere, for the same reason `forPipeline` in models.js does.
 */
export const effortsFor = (efforts, pipeline) => (Array.isArray(efforts) ? efforts : []).filter(
    (row) => row && row.id && (!Array.isArray(row.pipelines) || row.pipelines.includes(pipeline)),
);

export const findEffort = (efforts, effortId) => (
    (Array.isArray(efforts) ? efforts : []).find((row) => row?.id === effortId) || null
);

/** The model a level always runs on, or '' when the level leaves the choice to the picker. */
export const fixedModelFor = (efforts, effortId) => {
    if (!effortId) return '';
    const row = findEffort(efforts, effortId);
    return typeof row?.model === 'string' ? row.model : '';
};

/** Whether this deployment offers Quick on the given pipeline. */
export const isQuickAvailable = (efforts, pipeline = 'chat') => (
    effortsFor(efforts, pipeline).some((row) => row.id === EFFORT_QUICK)
);
