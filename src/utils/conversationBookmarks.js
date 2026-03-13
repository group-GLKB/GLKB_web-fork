const STORAGE_KEY = 'glkbConversationBookmarks';

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

export const toggleConversationBookmark = (entry) => {
    if (!entry || !entry.id) return getConversationBookmarks();
    const bookmarks = getConversationBookmarks();
    const index = bookmarks.findIndex((item) => String(item.id) === String(entry.id));
    let next = [];
    if (index >= 0) {
        next = bookmarks.filter((item) => String(item.id) !== String(entry.id));
    } else {
        next = [entry, ...bookmarks];
    }
    setConversationBookmarks(next);
    return next;
};
