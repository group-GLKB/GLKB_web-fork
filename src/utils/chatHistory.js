const STORAGE_KEY = 'llmConversations';
const ACTIVE_KEY = 'llmActiveConversationId';
const LEGACY_KEY = 'llmChatHistory';

const sortConversations = (list) => (
    [...list].sort((a, b) => (b?.updatedAt || 0) - (a?.updatedAt || 0))
);

const readConversations = () => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
};

export const getConversations = () => sortConversations(readConversations());

export const setConversations = (list) => {
    if (typeof window === 'undefined') return [];
    const sorted = sortConversations(list);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    window.dispatchEvent(new CustomEvent('glkb-conversations-updated', { detail: sorted }));
    return sorted;
};

export const getActiveConversationId = () => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(ACTIVE_KEY);
};

export const setActiveConversationId = (id) => {
    if (typeof window === 'undefined') return;
    if (!id) {
        sessionStorage.removeItem(ACTIVE_KEY);
        return;
    }
    sessionStorage.setItem(ACTIVE_KEY, id);
};

export const createConversation = (messages = []) => {
    const now = Date.now();
    return {
        id: `conv_${now}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: now,
        updatedAt: now,
        messages,
    };
};

export const upsertConversation = (list, conversation) => {
    const next = Array.isArray(list) ? [...list] : [];
    const index = next.findIndex((item) => item.id === conversation.id);
    if (index >= 0) {
        next[index] = { ...next[index], ...conversation };
    } else {
        next.unshift(conversation);
    }
    return sortConversations(next);
};

export const updateConversationMessages = (list, id, messages) => {
    if (!id) return sortConversations(list || []);
    const now = Date.now();
    let found = false;
    const next = (list || []).map((item) => {
        if (item.id !== id) return item;
        found = true;
        return {
            ...item,
            messages,
            updatedAt: now,
        };
    });

    if (!found) {
        next.unshift({
            id,
            createdAt: now,
            updatedAt: now,
            messages,
        });
    }

    return sortConversations(next);
};

export const migrateLegacyChatHistory = () => {
    if (typeof window === 'undefined') return [];
    const existing = readConversations();
    if (existing.length > 0) return existing;

    try {
        const legacyRaw = sessionStorage.getItem(LEGACY_KEY);
        if (!legacyRaw) return [];
        const legacyMessages = JSON.parse(legacyRaw);
        if (!Array.isArray(legacyMessages) || legacyMessages.length === 0) return [];

        const conversation = createConversation(legacyMessages);
        const next = setConversations([conversation]);
        setActiveConversationId(conversation.id);
        return next;
    } catch (error) {
        return [];
    }
};
