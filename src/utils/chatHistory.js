import {
  createChatHistory,
  deleteChatHistory,
  getChatHistoryDetail,
  listChatHistories,
  updateChatHistoryTitle,
} from '../service/ChatHistory';

const STORAGE_KEY = 'llmConversations';
const ACTIVE_KEY = 'llmActiveConversationId';

const sortConversations = (list) => (
    [...list].sort((a, b) => new Date(b?.updatedAt || 0) - new Date(a?.updatedAt || 0))
);

const getConversationMessageCount = (conversation) => {
    if (!conversation) return 0;
    const count = Number(conversation.messageCount);
    if (Number.isFinite(count) && count > 0) {
        return count;
    }
    if (Array.isArray(conversation.messages)) {
        return conversation.messages.length;
    }
    return Number.isFinite(count) ? count : 0;
};

const isTransientZeroMessageState = () => {
    if (typeof window === 'undefined') return false;
    const inChatPage = window.location.pathname === '/chat';
    const wasProcessing = sessionStorage.getItem('llmWasProcessing') === 'true';
    return inChatPage || wasProcessing;
};

const pruneZeroMessageConversations = (list, activeId) => {
    const normalizedActiveId = activeId ? String(activeId) : null;
    const source = Array.isArray(list) ? list : [];
    const allowTransientZero = isTransientZeroMessageState();
    return source.filter((conversation) => {
        const id = String(conversation?.id || '');
        if (!id) return false;
        const messageCount = getConversationMessageCount(conversation);
        if (messageCount > 0) return true;
        // Keep only active zero-message conversation in transient chat states.
        return allowTransientZero && normalizedActiveId === id;
    });
};

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

const formatTimestamp = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const normalizeReferences = (refs) => {
    if (!Array.isArray(refs)) return [];
    return refs.map((ref) => {
        if (Array.isArray(ref)) {
            const [title, pubmedUrl, citationCount, year, journal, authors] = ref;
            return {
                title,
                url: pubmedUrl,
                citation_count: citationCount,
                year,
                journal,
                authors: Array.isArray(authors) ? authors.join(', ') : 'Authors not available',
                evidence: [],
            };
        }

        const title = ref?.title || '';
        const url = ref?.url || '';
        const citationCount = ref?.n_citation ?? ref?.citation_count ?? 0;
        const year = ref?.date ?? ref?.year ?? '';
        const journal = ref?.journal || '';
        const authors = Array.isArray(ref?.authors) ? ref.authors.join(', ') : 'Authors not available';
        const evidence = Array.isArray(ref?.evidence) ? ref.evidence : [];
        return {
            title,
            url,
            citation_count: citationCount,
            year,
            journal,
            authors,
            evidence,
        };
    });
};

const normalizeSummary = (summary) => ({
    id: String(summary.hid),
    hid: summary.hid,
    leadingTitle: summary.leading_title || 'New Chat',
    createdAt: summary.created_at,
    updatedAt: summary.last_accessed_time,
    messageCount: summary.message_count ?? 0,
    messages: [],
});

const normalizeDetail = (detail) => ({
    id: String(detail.hid),
    hid: detail.hid,
    leadingTitle: detail.leading_title || 'New Chat',
    createdAt: detail.created_at,
    updatedAt: detail.last_accessed_time,
    messageCount: Array.isArray(detail.messages) ? detail.messages.length : 0,
    messages: Array.isArray(detail.messages)
        ? detail.messages.map((message) => ({
            role: message.role,
            content: message.content ?? '',
            references: normalizeReferences(message.references),
            timestamp: formatTimestamp(message.created_at),
            trajectory: message.trajectory || null,
            invocationId: message.invocation_id ?? message.invocationId ?? null,
        }))
        : [],
});

export const getConversations = () => {
    const activeId = getActiveConversationId();
    return sortConversations(pruneZeroMessageConversations(readConversations(), activeId));
};

export const setConversations = (list, options = {}) => {
    if (typeof window === 'undefined') return [];
    const activeId = Object.prototype.hasOwnProperty.call(options, 'activeId')
        ? options.activeId
        : getActiveConversationId();
    const cleaned = pruneZeroMessageConversations(list, activeId);
    const sorted = sortConversations(cleaned);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    window.dispatchEvent(new CustomEvent('glkb-conversations-updated', { detail: sorted }));
    return sorted;
};

export const fetchConversations = async (options = {}) => {
    const { offset = 0, limit = 20 } = options;
    const data = await listChatHistories({ offset, limit });
    const list = Array.isArray(data?.histories)
        ? data.histories.map(normalizeSummary)
        : [];
    return setConversations(list);
};

export const fetchConversationDetail = async (id) => {
    if (!id) return null;
    const data = await getChatHistoryDetail(id);
    const conversation = normalizeDetail(data);
    const next = upsertConversation(getConversations(), conversation);
    setConversations(next);
    return conversation;
};

export const createConversation = async (leadingTitle = null) => {
    const data = await createChatHistory(leadingTitle);
    const conversation = normalizeSummary(data);
    const next = upsertConversation(getConversations(), conversation);
    setConversations(next, { activeId: conversation.id });
    setActiveConversationId(conversation.id);
    return conversation;
};

export const updateConversationTitle = async (id, leadingTitle) => {
    if (!id) return null;
    const data = await updateChatHistoryTitle(id, leadingTitle);
    const conversation = normalizeSummary(data);
    const next = upsertConversation(getConversations(), conversation);
    setConversations(next);
    return conversation;
};

export const removeConversation = async (id) => {
    if (!id) return null;
    const result = await deleteChatHistory(id);
    const next = getConversations().filter((item) => item.id !== String(id));
    setConversations(next);
    if (getActiveConversationId() === String(id)) {
        setActiveConversationId(null);
    }
    return result;
};

export const getActiveConversationId = () => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(ACTIVE_KEY);
};

export const setActiveConversationId = (id) => {
    if (typeof window === 'undefined') return;
    if (!id) {
        sessionStorage.removeItem(ACTIVE_KEY);
        setConversations(readConversations(), { activeId: null });
        return;
    }
    const normalizedId = String(id);
    sessionStorage.setItem(ACTIVE_KEY, normalizedId);
    setConversations(readConversations(), { activeId: normalizedId });
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
    const now = new Date().toISOString();
    let found = false;
    const next = (list || []).map((item) => {
        if (item.id !== id) return item;
        found = true;
        return {
            ...item,
            messages,
            updatedAt: now,
            messageCount: Array.isArray(messages) ? messages.length : item.messageCount,
        };
    });

    if (!found) {
        next.unshift({
            id: String(id),
            hid: Number(id),
            leadingTitle: 'New Chat',
            createdAt: now,
            updatedAt: now,
            messageCount: Array.isArray(messages) ? messages.length : 0,
            messages,
        });
    }

    return sortConversations(next);
};

export const migrateLegacyChatHistory = () => [];
