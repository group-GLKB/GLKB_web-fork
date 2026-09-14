// Separate the last submitted pipeline from the server's sticky "ever investigated" label.
const MODE_KEY = 'glkb_submitted_conversation_modes';
const readModes = () => {
    try {
        const value = JSON.parse(window.localStorage.getItem(MODE_KEY) || '{}');
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch { return {}; }
};
export const readSubmittedMode = (id) => {
    if (id == null) return undefined;
    const mode = readModes()[String(id)];
    return typeof mode === 'boolean' ? mode : undefined;
};
export const recordSubmittedMode = (id, mode) => {
    if (id == null || typeof mode !== 'boolean') return;
    try {
        window.localStorage.setItem(MODE_KEY, JSON.stringify({ ...readModes(), [String(id)]: mode }));
    } catch { /* Restricted storage must not prevent submitting a question. */ }
};

/** Resolve only data belonging to the target conversation, never the previous view's mode. */
export const resolveConversationMode = ({
    conversationId = null, conversation = null, snapshot = null, messages = [],
    submittedMode,
} = {}) => {
    const sameId = (id) => String(id ?? '') === String(conversationId ?? '');
    const ownConversation = conversationId != null && sameId(conversation?.id)
        ? conversation : null;
    const ownSnapshot = snapshot && sameId(snapshot.conversationId) ? snapshot : null;
    if (typeof submittedMode === 'boolean') return submittedMode;
    // Versioned request intent is stronger than an historical conversation label.
    const ownMessages = conversationId == null ? messages : (ownConversation?.messages || []);
    const submitted = [...ownMessages].reverse().find((message) =>
        message?.role === 'user' && message.modeSource === 'submitted'
        && typeof message.investigateMode === 'boolean');
    if (submitted) return submitted.investigateMode;
    // The server's explicit mode outranks legacy snapshots that inferred Investigate
    // from run_id, which is now also returned by ordinary chat.
    if (typeof ownConversation?.isInvestigate === 'boolean') return ownConversation.isInvestigate;
    // For named conversations use their stored transcript; view messages may still belong
    // to the previous route while a history request is in flight.
    // A local icon marker alone is not proof of which pipeline the current run uses.
    return Boolean(
        ownConversation?.isInvestigate
        || ownSnapshot?.investigate
        || ownMessages.some((message) => message?.investigateMode === true)
    );
};

// Snapshot presentation must agree with the resolved pipeline, without changing prior turns.
export const normalizePendingMode = (messages, investigate) => {
    if (!Array.isArray(messages) || !messages.length) return messages;
    const last = messages[messages.length - 1];
    if (last?.role !== 'assistant' || last.investigateMode === investigate) return messages;
    return [...messages.slice(0, -1), { ...last, investigateMode: investigate }];
};

export const resolveQueuedSearchOptions = (entry, fallbackMode) => ({
    ...(entry?.searchOptions || {}),
    // Old queued booleans may have been inferred from run_id rather than user intent.
    investigateEnabled: entry?.pipelineVersion === 1
        && typeof entry?.searchOptions?.investigateEnabled === 'boolean'
        ? entry.searchOptions.investigateEnabled : fallbackMode,
});
