/**
 * "Ask in Investigate" under a chat answer whose search was cut short.
 *
 * The agent marks such an answer with `search_limit` on its `Complete` frame — "context" when
 * the turn's material outgrew the model's context and it answered from what it had, "calls"
 * when it reached its cap on model calls — and the backend keeps the flag on the answer's trace,
 * so a reloaded answer carries it too (`searchLimit` on the message, see traceReplay.js).
 *
 * The offer is the same question asked again as an Investigate run, which reads many more
 * papers. It is started the way the home composer's Investigate tab starts one: a new
 * conversation, handed over in navigation state (`initialQuery` / `initialSearchOptions`, read
 * by the chat page's hand-over effect), so it is an Investigate conversation from its first
 * turn and every follow-up in it stays deep research.
 */
import { searchLimitOf } from '../../service/LLMAgent';

/** Whether a message is a chat answer that should carry the notice. Never an Investigate one. */
export const showsSearchLimit = (message) => Boolean(
    message
    && message.role === 'assistant'
    && !message.investigateMode
    && searchLimitOf(message.searchLimit),
);

/**
 * The question to ask again: the reader's own text for the turn the answer at `index` replied
 * to. Its files are dropped (Investigate does not read attachments) — they live on the message's
 * `attachments`, never in its text, so the text is all there is to take. '' when there is no
 * such turn.
 */
export const investigateQuestionFor = (history, index) => {
    if (!Array.isArray(history)) return '';
    for (let i = Math.min(index, history.length) - 1; i >= 0; i -= 1) {
        const message = history[i];
        if (message?.role === 'user') return String(message.content ?? '').trim();
        if (message?.role === 'assistant') return '';
    }
    return '';
};

/**
 * The navigation state that opens the new Investigate conversation — the same shape the home
 * composer sends with its Investigate tab: deep research takes no filters or ranking and does
 * figures and the graph on its own, and the tier goes along because it is priced and run by it.
 */
export const investigateHandoffState = (question, serviceTier = '') => ({
    initialQuery: question,
    initialSearchOptions: {
        filters: [],
        rankingMode: 'default',
        investigateEnabled: true,
        serviceTier: typeof serviceTier === 'string' ? serviceTier : '',
    },
    initialQueryMethod: 'button',
});
