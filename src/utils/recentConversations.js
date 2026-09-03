/**
 * Keep every conversation with an answer in flight ahead of settled conversations.
 *
 * Both partitions preserve the order supplied by chatHistory, so loading rows remain ordered
 * by recent activity without jumping behind a settled row. Partitioning happens before the
 * Recent limit is applied, which also keeps a running row visible when the list is long.
 */
export const prioritizeRunningConversations = (conversations, runningConversationIds) => {
    const source = Array.isArray(conversations) ? conversations : [];
    const runningIds = runningConversationIds instanceof Set
        ? runningConversationIds
        : new Set(runningConversationIds || []);
    const running = [];
    const settled = [];

    source.forEach((conversation) => {
        const bucket = conversation?.id != null && runningIds.has(String(conversation.id))
            ? running
            : settled;
        bucket.push(conversation);
    });

    return [...running, ...settled];
};

export default prioritizeRunningConversations;
