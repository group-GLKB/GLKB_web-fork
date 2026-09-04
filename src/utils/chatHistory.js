import {
  createChatHistory,
  deleteChatHistory,
  getChatHistoryDetail,
  getChatHistoryDetailByPublicId,
  listChatHistories,
  updateChatHistoryTitle,
} from '../service/ChatHistory';
import { isConversationRunning, reconcileRunsWithServer } from '../service/activeRun';
import { isExchangeUnfinished } from '../service/resumeRun';
import { parseServerTime, serverTimeMs, toIsoUtc } from './serverTime';

const STORAGE_KEY = 'llmConversations';
const ACTIVE_KEY = 'llmActiveConversationId';

/* Newest first, and stable when two rows share a moment. `updatedAt` is normalised to ISO-UTC
   as it enters the app (see normalizeSummary), so the server's timestamps and the ones this
   file writes for a running conversation are finally on one clock — before that the server's
   read hours into the future and the lift to the top of the sidebar was undone on every list
   refresh. A row with no readable timestamp sorts last rather than poisoning the comparator
   with NaN, which leaves the whole list in whatever order it happened to arrive in. */
const sortConversations = (list) => (
    [...list]
        .map((item, index) => ({ item, index, at: serverTimeMs(item?.updatedAt) ?? 0 }))
        .sort((a, b) => (b.at - a.at) || (a.index - b.index))
        .map(({ item }) => item)
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
    // startsWith, because a conversation's own URL is /chat/<public_id>. Exact-matching here
    // pruned a just-created, still-empty conversation out of the list the moment it had an
    // address of its own.
    const inChatPage = window.location.pathname.startsWith('/chat');
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
    const date = parseServerTime(value);
    if (!date) return '';
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
    // The URL-safe id. Null on a row the backend has not backfilled, which is why every
    // reader falls back to the hid rather than assuming it is there.
    publicId: summary.public_id || null,
    leadingTitle: summary.leading_title || 'New Chat',
    /* ISO-UTC, not the string the API sent. The backend writes naive UTC and Pydantic
       serialises it with no designator, which `new Date()` reads as local time — see
       utils/serverTime.js. Normalising here means every reader downstream (this file's sort,
       the History and Library relative times) is on one clock without knowing about it. */
    createdAt: toIsoUtc(summary.created_at),
    updatedAt: toIsoUtc(summary.last_accessed_time),
    messageCount: summary.message_count ?? 0,
    // Whether this conversation ever ran deep research. Written by the backend on
    // /deep-research/stream and sticky once set, so it labels the conversation rather
    // than its last turn. Absent on a server that predates the field, which reads the
    // same as false — see investigateConversations.js for what covers that gap.
    isInvestigate: summary.is_investigate === true,
    /* Whether the server is still writing this conversation's last exchange, and the address
       that run can be collected at. Absent on a server that predates them, which reads as
       "nothing in flight" — the same as before. Together they let a client that kept no notes
       of its own (a closed tab, cleared storage, another device) find an answer again. */
    isAnswering: summary.is_answering === true,
    sessionId: summary.session_id || null,
    messages: [],
});

const normalizeDetail = (detail) => ({
    id: String(detail.hid),
    hid: detail.hid,
    publicId: detail.public_id || null,
    leadingTitle: detail.leading_title || 'New Chat',
    createdAt: toIsoUtc(detail.created_at),
    updatedAt: toIsoUtc(detail.last_accessed_time),
    isInvestigate: detail.is_investigate === true,
    isAnswering: detail.is_answering === true,
    sessionId: detail.session_id || null,
    messageCount: Array.isArray(detail.messages) ? detail.messages.length : 0,
    messages: Array.isArray(detail.messages)
        ? detail.messages.map((message) => ({
            id: message.id ?? message.mid ?? message.message_id ?? null,
            role: message.role,
            content: message.content ?? '',
            references: normalizeReferences(message.references),
            timestamp: formatTimestamp(message.created_at),
            trajectory: message.trajectory || null,
            invocationId: message.invocation_id ?? message.invocationId ?? null,
            // null for user messages, for answers saved before this shipped, and for
            // answers with no bindings — all of which mean the same thing here.
            directCitations: message.direct_citations ?? message.directCitations ?? null,
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
    /* The list endpoint returns titles, not messages, and a summary row carries
       `messages: []`. Replacing the stored list wholesale therefore erased every locally
       known transcript on every refresh — including the optimistic turn of a run still in
       flight, which is the only record of a question the server has not saved yet.

       Only that in-flight copy is worth keeping: a conversation that is running, or whose
       stored copy ends mid-exchange, is ahead of the server. A settled local copy is not —
       it can hold stale or error text the server never saved, and preserving it
       unconditionally meant a list refresh could never repair it. The count always stays
       the server's: it feeds the History/Library labels, which describe what is saved. */
    /* What the server says is still being answered, settled against what this tab thinks.
       Done before the merge below, because `isConversationRunning` is one of the things that
       merge asks — and after a reload the answer used to be "nothing", which threw away the
       optimistic turn of every run still in flight. */
    reconcileRunsWithServer(list);
    const known = new Map(getConversations().map((item) => [String(item.id), item]));
    const merged = list.map((item) => {
        const stored = known.get(String(item.id));
        if (!stored) return item;
        const keepMessages = stored.messages?.length && !item.messages?.length
            && (isConversationRunning(item.id) || isExchangeUnfinished(stored.messages));
        /* The newer of the two timestamps. A run touches its conversation locally the moment
           it starts writing, before the server has saved anything; taking the summary's older
           `last_accessed_time` dropped the conversation being answered down the sidebar
           mid-run, under rows that were long finished. */
        const storedAt = serverTimeMs(stored.updatedAt);
        const summaryAt = serverTimeMs(item.updatedAt);
        const keepUpdatedAt = storedAt != null && summaryAt != null && storedAt > summaryAt;
        if (!keepMessages && !keepUpdatedAt) return item;
        return {
            ...item,
            ...(keepMessages ? { messages: stored.messages } : {}),
            ...(keepUpdatedAt ? { updatedAt: stored.updatedAt } : {}),
            // The session id is the address a recovery reconnects at; a summary that arrives
            // without one (an older server) must not erase the one already known.
            sessionId: item.sessionId || stored.sessionId || null,
        };
    });
    return setConversations(merged);
};

/**
 * Restore a conversation from the id in the URL.
 *
 * This is what makes /chat/<id> work on a cold load. The conversation list and the active-id
 * pointer live in sessionStorage, which the browser discards when the tab closes — so before
 * the URL carried the id, reopening the page after closing it had nothing to restore from and
 * showed an empty chat.
 */
/**
 * Where to send the reader to open this conversation.
 *
 * `/chat/<public_id>` when the row has one — an address that survives a reload, a new tab and
 * being pasted to someone else. Plain `/chat` otherwise, and the caller passes the id in
 * router state as before: rows created before the backend backfilled `public_id` still have
 * to open.
 */
export const chatPathForConversation = (conversation) => (
    conversation?.publicId ? `/chat/${conversation.publicId}` : '/chat'
);

export const fetchConversationDetailByPublicId = async (publicId) => {
    if (!publicId) return null;
    const data = await getChatHistoryDetailByPublicId(publicId);
    const conversation = normalizeDetail(data);
    setConversations(upsertConversation(getConversations(), conversation));
    return conversation;
};

export const fetchConversationDetail = async (id) => {
    if (!id) return null;
    const data = await getChatHistoryDetail(id);
    const conversation = normalizeDetail(data);
    const next = upsertConversation(getConversations(), conversation);
    setConversations(next);
    return conversation;
};

export const createConversation = async (leadingTitle = null, isInvestigate = false) => {
    const data = await createChatHistory(leadingTitle, isInvestigate);
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

/**
 * Write a conversation's messages back into the list.
 *
 * `touch` moves the conversation to the top of the sidebar by dating it now. The list is
 * ordered by `updatedAt`, which is the server's `last_accessed_time` and only changes when
 * the list is refetched — which happens on `Complete`. So without this the conversation
 * being answered right now sat at whatever rank it held before the question was asked, and
 * only jumped to the top once the answer had already landed: the reader watched the run in
 * the wrong place for the whole time it was running.
 *
 * Only the run writes with `touch`. Merely opening an old conversation also lands here (the
 * effect that mirrors `chatHistory` into the list), and reordering History as a side effect
 * of reading it is not what anyone asked for.
 */
export const updateConversationMessages = (list, id, messages, options = {}) => {
    if (!id) return sortConversations(list || []);
    const { touch = false } = options;
    let found = false;
    const next = (list || []).map((item) => {
        if (item.id !== id) return item;
        found = true;
        return {
            ...item,
            messages,
            messageCount: Array.isArray(messages) ? messages.length : item.messageCount,
            ...(touch ? { updatedAt: new Date().toISOString() } : {}),
        };
    });

    if (!found) {
        const now = new Date().toISOString();
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
