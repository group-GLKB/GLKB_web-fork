import {
  addFavoriteChat,
  listFavoriteChats,
  removeFavoriteChat,
} from '../service/Favorites';
import { getMyTier } from '../service/Tier';

const STORAGE_KEY = 'glkbConversationBookmarks';
const FREE_BOOKMARK_BLOCKED_EVENT = 'glkb-free-bookmark-blocked';

const normalizeSession = (session) => {
    if (!session) return null;
    const hid = session.hid ?? session.id;
    const messages = Array.isArray(session.messages) ? session.messages : [];
    return {
        id: String(hid ?? ''),
        hid: hid ?? null,
        title: session.leading_title || session.title || 'New Chat',
        leadingTitle: session.leading_title || session.title || 'New Chat',
        createdAt: session.created_at || session.createdAt || null,
        updatedAt: session.last_accessed_time || session.updatedAt || null,
        messageCount: session.message_count ?? messages.length,
        messages,
    };
};

const normalizeSessionList = (payload) => {
    const list = Array.isArray(payload?.sessions)
        ? payload.sessions
        : (Array.isArray(payload) ? payload : []);
    return list.map(normalizeSession).filter(Boolean);
};

export const getConversationBookmarks = () => {
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

export const setConversationBookmarks = (bookmarks) => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    window.dispatchEvent(new CustomEvent('glkb-conversation-bookmarks-updated', { detail: bookmarks }));
};

export const fetchConversationBookmarks = async () => {
    const data = await listFavoriteChats();
    const normalized = normalizeSessionList(data);
    setConversationBookmarks(normalized);
    return normalized;
};

export const toggleConversationBookmark = async (entry) => {
    if (!entry || (!entry.id && !entry.hid)) return getConversationBookmarks();
    const bookmarks = getConversationBookmarks();
    const hid = String(entry.hid ?? entry.id ?? '').trim();
    if (!hid) return bookmarks;
    const index = bookmarks.findIndex((item) => String(item.id) === hid || String(item.hid) === hid);

    const tierResult = await getMyTier();
    if (tierResult?.success && index < 0) {
        const bookmarkAllowed = tierResult?.data?.bookmark_allowed;
        const normalizedTier = `${tierResult?.data?.tier || 'free'}`.toLowerCase();
        if (bookmarkAllowed === false || normalizedTier === 'free') {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent(FREE_BOOKMARK_BLOCKED_EVENT));
            }
            return bookmarks;
        }
    }

    let next = [];

    if (index >= 0) {
        await removeFavoriteChat(hid);
        next = bookmarks.filter((item) => String(item.id) !== hid && String(item.hid) !== hid);
    } else {
        try {
            await addFavoriteChat(Number(hid));
        } catch (error) {
            const status = error?.response?.status;
            const detail = `${error?.response?.data?.detail || ''}`.toLowerCase();
            if (status === 403 || detail.includes('free') || detail.includes('bookmark')) {
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent(FREE_BOOKMARK_BLOCKED_EVENT));
                }
                return bookmarks;
            }
            throw error;
        }
        const normalized = normalizeSession({
            hid: Number(hid),
            leading_title: entry.title || entry.leadingTitle || 'New Chat',
            last_accessed_time: entry.updatedAt || new Date().toISOString(),
            message_count: entry.messageCount ?? 0,
        });
        next = [normalized, ...bookmarks.filter((item) => String(item.id) !== normalized.id)];
    }

    setConversationBookmarks(next);
    return next;
};
