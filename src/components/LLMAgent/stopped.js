/**
 * What a run the reader stopped leaves on screen.
 *
 * Three paths reach this now, and they must agree, because the reader can meet more than one
 * of them in a single run: the live Stop (the stream is aborted), a reattached Stop (there is
 * no stream — the view is polling, so the poll loop has to end itself), and a poll that finds
 * the run already `cancelled` (another tab, or this one before a reload). The rule they share:
 *
 *   A run that had already written something KEEPS it. Partial work is worth reading, and
 *   overwriting it with a notice is a worse outcome than the stop itself.
 *
 *   A run with an empty bubble gets a sentence. Deep research reveals its report only at the
 *   very end, so stopping it mid-way leaves nothing at all in the assistant bubble — which
 *   reads as a broken answer rather than as the thing the reader just asked for.
 *
 * The backend writes the same sentences into the conversation (`app/core/stopped.py`), so the
 * copy on screen and the copy in history agree and a reload does not swap one for the other.
 * Two of them, because the two products are not the same thing to a reader: Investigate is a
 * multi-minute research run they watched, chat is an answer.
 */
export const STOPPED_BY_USER_TEXT = {
    chat: '_This answer was stopped before it finished._',
    investigate: '_This investigation was stopped before it finished._',
};

export const stoppedMessageFor = (investigate) => (
    STOPPED_BY_USER_TEXT[investigate ? 'investigate' : 'chat']
);

/**
 * Whether the stopped run already has something on screen worth keeping — in which case no
 * sentence is written over it.
 */
export const keepsWhatItWrote = (messages) => {
    const last = (Array.isArray(messages) ? messages : [])?.slice(-1)[0];
    return last?.role === 'assistant' && Boolean(String(last.content || '').trim());
};

/**
 * The transcript after a stop. Returns the SAME array when nothing should change, so a caller
 * passing it to a state setter does not force a render for a no-op.
 *
 * `patch` carries the fields the caller knows and this module does not (the thinking steps it
 * collected, how long the run lasted).
 */
export const withStoppedMessage = (messages, { investigate = false, patch = null } = {}) => {
    const list = Array.isArray(messages) ? messages : [];
    if (!list.length) return list;
    const last = list[list.length - 1];
    if (last?.role !== 'assistant') return list;
    if (keepsWhatItWrote(list)) return list;
    const next = [...list];
    next[next.length - 1] = { ...last, content: stoppedMessageFor(investigate), ...(patch || {}) };
    return next;
};
