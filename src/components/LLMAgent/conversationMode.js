/** Resolve only data belonging to the target conversation, never the previous view's mode. */
export const resolveConversationMode = ({
    conversationId = null, conversation = null, snapshot = null, messages = [], marked = false,
} = {}) => {
    const sameId = (id) => String(id ?? '') === String(conversationId ?? '');
    const ownConversation = conversationId != null && sameId(conversation?.id)
        ? conversation : null;
    const ownSnapshot = snapshot && sameId(snapshot.conversationId) ? snapshot : null;
    // The server's explicit mode outranks legacy snapshots that inferred Investigate
    // from run_id, which is now also returned by ordinary chat.
    if (typeof ownConversation?.isInvestigate === 'boolean') return ownConversation.isInvestigate;
    // For named conversations use their stored transcript; view messages may still belong
    // to the previous route while a history request is in flight.
    const ownMessages = conversationId == null ? messages : (ownConversation?.messages || []);
    return Boolean(
        ownConversation?.isInvestigate
        || ownSnapshot?.investigate
        || (conversationId != null && marked)
        || ownMessages.some((message) => message?.investigateMode === true)
    );
};
