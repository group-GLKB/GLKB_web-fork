/**
 * Is this conversation waiting on an answer that never arrived?
 *
 * The server keeps running when the browser goes away, so a reload can land on a conversation
 * whose last exchange is still being written. Two shapes mean the same thing:
 *
 *   - the last message is the USER's, because the backend saves the prompt immediately and only
 *     writes the assistant row when the run finishes (`start_exchange` / `finish_exchange`);
 *   - the last message is an ASSISTANT one with no text, which is the placeholder the chat
 *     appends locally while a run is in flight.
 *
 * Its own module, with no imports, so the rule can be tested without pulling the whole app in.
 */
export const isExchangeUnfinished = (messages) => {
    if (!Array.isArray(messages) || messages.length === 0) return false;
    const last = messages[messages.length - 1];
    if (!last || typeof last !== 'object') return false;
    if (last.role === 'user') return true;
    return last.role === 'assistant' && !String(last.content || '').trim();
};

export default isExchangeUnfinished;
