// Keep an explicitly selected source; otherwise use the latest cited answer in this chat.
export const resolveReferenceSourceIndex = (messages = [], selectedIndex = null) => {
    const hasReferences = (message) => message?.role === 'assistant'
        && Array.isArray(message.references) && message.references.length > 0;
    if (hasReferences(messages[selectedIndex])) return selectedIndex;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (hasReferences(messages[index])) return index;
    }
    return null;
};
