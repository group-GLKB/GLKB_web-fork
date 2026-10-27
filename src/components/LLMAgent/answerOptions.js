import { answerOptionsOf } from '../../service/LLMAgent';

/* A chat turn's answer options ({figures, graph}): what the composer chose when this turn
   starts a conversation; otherwise the conversation's, carried by its latest answer. So the
   options picked on the home page stay with every follow-up of that conversation, also after
   it is reopened from History. Investigate does both on its own and is sent neither. */
export const answerOptionsForTurn = (searchOptions, history, investigate) => {
    if (investigate) return {};
    if (searchOptions && ('figures' in searchOptions || 'graph' in searchOptions)) {
        return answerOptionsOf(searchOptions);
    }
    const last = [...(history || [])].reverse()
        .find((m) => m?.role === 'assistant' && !m.investigateMode && m.answerOptions);
    return answerOptionsOf(last?.answerOptions);
};
