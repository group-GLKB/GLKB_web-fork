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
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    } catch (error) {
        /* Quota, or storage denied outright. The list still reaches the caller and the event
           below still fires — the cache is an optimisation, and paging deep into History
           (every page is merged in here) is exactly when it can hit the ceiling. */
    }
    window.dispatchEvent(new CustomEvent('glkb-conversations-updated', { detail: sorted }));
    return sorted;
};

/** A list row settled against what this tab already knows about that conversation. */
const mergeSummaryWithStored = (item, stored) => {
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
};

/* One page of the list, merged into the store WITHOUT dropping the pages already there.
   This is the helper for paging DOWN the list — it takes a cursor and unions what comes back.
   `fetchConversations` below re-reads the newest page instead, and keeps what lies beneath it
   (see `conversationsBelowPage`); before it did, a refresh of page one cut a History that had
   paged to 100 back to the newest 20.

   Returns the page plus what the server said about the list as a whole: `total` (how many
   conversations the reader has, counting only the non-empty ones a client can show) and
   `nextCursor` (what to send as `before` for the page after this one). */
export const fetchConversationPage = async ({ limit = 20, before = null } = {}) => {
    const data = await listChatHistories({ limit, before });
    const page = Array.isArray(data?.histories) ? data.histories.map(normalizeSummary) : [];
    reconcileRunsWithServer(page);
    const stored = new Map(getConversations().map((item) => [String(item.id), item]));
    const merged = page.map((item) => mergeSummaryWithStored(item, stored.get(String(item.id))));
    const known = new Map(getConversations().map((item) => [String(item.id), item]));
    for (const item of merged) known.set(String(item.id), item);
    const total = Number(data?.total);
    return {
        items: merged,
        stored: setConversations([...known.values()]),
        total: Number.isFinite(total) ? total : null,
        // A server without the cursor field still answers; the page is then the last one we
        // can ask for safely, which is what a null cursor means to the caller.
        nextCursor: data?.next_cursor ?? data?.nextCursor ?? null,
    };
};

/**
 * How many conversations a refresh of the list validates — and therefore the most any view
 * may show from the store.
 *
 * These have to be ONE number. The store is shared: the sidebar draws it, the chat page
 * refreshes it after every answer. When the refresh covered fewer rows than the sidebar drew,
 * the rows in between were frozen at whatever some earlier fetch had seen — a conversation
 * deleted in another tab kept its place in the list, and clicking it opened nothing.
 */
export const RECENT_CONVERSATION_LIMIT = 50;

/**
 * The stored conversations a refresh of the newest page has no opinion about.
 *
 * A page of the list is authoritative only over the window it covers. Rows newer than its
 * last row that did not come back are gone from the server — deleted here or in another tab
 * — and must leave the store. Rows OLDER than its last row were never in the running: the
 * server was asked for the newest `limit`, so their absence says nothing, and dropping them
 * is what let a refresh of page one silently truncate a History that had paged to 100.
 *
 * A short page is the exception. Fewer rows than were asked for means that page is the whole
 * list, so there is no window below it and anything still stored has been deleted.
 *
 * A row that ties the page's last timestamp is below the window, not inside it: the server
 * breaks that tie on an id this list does not carry, so the page genuinely does not say
 * whether such a row is the next one down or was deleted. Keeping it is the answer that
 * cannot lose a real conversation, and a stale one can only sit at the far edge of a window
 * every caller now validates in full.
 */
export const conversationsBelowPage = (page, stored, limit) => {
    if (!Array.isArray(page) || !Array.isArray(stored)) return [];
    // Nothing below a page the server could not fill — it was the entire list.
    if (page.length < limit) return [];
    const tailAt = serverTimeMs(page[page.length - 1]?.updatedAt);
    // A page whose oldest row has no readable timestamp places no boundary. Keeping nothing
    // is what this function did before it existed, and is the answer that cannot resurrect a
    // deleted conversation.
    if (tailAt == null) return [];
    const onThisPage = new Set(page.map((item) => String(item?.id)));
    return stored.filter((item) => (
        // A row whose own timestamp is unreadable counts as 0 here, which keeps it — and
        // sorts it to the very bottom of the store, below anything a caller draws.
        !onThisPage.has(String(item?.id)) && (serverTimeMs(item?.updatedAt) ?? 0) <= tailAt
    ));
};

/**
 * A row kept below the window, with the transcript it no longer needs to hold.
 *
 * `mergeSummaryWithStored` keeps a stored transcript only while the conversation is ahead of
 * the server — running, or ending mid-exchange. Rows below the window never pass through it,
 * so without this they would hold their full answers in sessionStorage for the life of the
 * tab; a reader who opens forty deep-research reports has megabytes of them in a store whose
 * quota fails silently (see `setConversations`). Reopening a conversation re-fetches it.
 */
const withoutSettledTranscript = (item) => {
    if (!item?.messages?.length) return item;
    if (isConversationRunning(item.id) || isExchangeUnfinished(item.messages)) return item;
    // The count has to survive the transcript: a row that cannot say how many messages it
    // holds reads as empty, and an empty row is pruned out of the store entirely.
    const count = Number(item.messageCount);
    if (!Number.isFinite(count) || count <= 0) return item;
    return { ...item, messages: [] };
};

export const fetchConversations = async (options = {}) => {
    const { offset = 0, limit = RECENT_CONVERSATION_LIMIT } = options;
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
    const stored = getConversations();
    const known = new Map(stored.map((item) => [String(item.id), item]));
    const merged = list.map((item) => mergeSummaryWithStored(item, known.get(String(item.id))));
    /* Only the newest page was asked for, so only the newest page may be rewritten. An
       `offset` puts the window somewhere this cannot reason about, and no caller passes one;
       such a call keeps the old wholesale replace rather than guessing at a boundary. */
    const below = offset
        ? []
        : conversationsBelowPage(list, stored, limit).map(withoutSettledTranscript);
    return setConversations([...merged, ...below]);
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

/**
 * Keep a locally-ahead transcript when the server's copy of the same conversation is shorter.
 *
 * A follow-up being answered in the background writes its [question, ""] pair to the store
 * before the server has saved anything. Upserting the detail response over that erased the
 * pair, so the next visit to the conversation showed neither the question the reader had
 * already sent nor its spinner — the "my follow-up disappeared when I switched back" half of
 * the report — and, the local copy no longer looking ahead, the visit-time reconcile then
 * took the run's registry mark down while it was still writing.
 *
 * Only for a conversation that is RUNNING and whose local copy ends mid-exchange: a settled
 * local copy can hold stale text, and the server's is the one to keep.
 */
const withLocallyAheadMessages = (conversation) => {
    const stored = getConversations().find(
        (item) => String(item.id) === String(conversation?.id),
    );
    const local = stored?.messages;
    const server = conversation?.messages;
    const serverMessages = Array.isArray(server) ? server : [];
    /* Two ways the local copy is the better one, and both are about a turn the server has not
       finished writing. Either it is still being answered here (the optimistic [question, ""]
       pair of a background follow-up), or it was answered here through the run-recovery poll
       while the server's copy still ends at the dangling prompt. Overwriting either loses the
       only complete record the reader has. */
    const aheadOfServer = Array.isArray(local)
        && local.length > serverMessages.length
        && isExchangeUnfinished(local)
        && isConversationRunning(conversation?.id);
    const answeredHere = Array.isArray(local)
        && local.length >= serverMessages.length
        && local.length > 0
        && isExchangeUnfinished(serverMessages)
        && !isExchangeUnfinished(local);
    return (aheadOfServer || answeredHere) ? { ...conversation, messages: local } : conversation;
};

export const fetchConversationDetailByPublicId = async (publicId) => {
    if (!publicId) return null;
    const data = await getChatHistoryDetailByPublicId(publicId);
    const conversation = normalizeDetail(data);
    // The STORE keeps whichever copy is further along; the caller still gets the server's,
    // which is what a background turn must build its next request on.
    setConversations(upsertConversation(getConversations(), withLocallyAheadMessages(conversation)));
    return conversation;
};

export const fetchConversationDetail = async (id) => {
    if (!id) return null;
    const data = await getChatHistoryDetail(id);
    const conversation = normalizeDetail(data);
    const next = upsertConversation(getConversations(), withLocallyAheadMessages(conversation));
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
