const STORAGE_KEY = 'glkbBookmarks';

export const getBookmarks = () => {
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

export const setBookmarks = (bookmarks) => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    window.dispatchEvent(new CustomEvent('glkb-bookmarks-updated', { detail: bookmarks }));
};

export const toggleBookmark = (entry) => {
    if (!entry || !entry.id) return getBookmarks();
    const bookmarks = getBookmarks();
    const index = bookmarks.findIndex((item) => item.id === entry.id);
    let next = [];
    if (index >= 0) {
        next = bookmarks.filter((item) => item.id !== entry.id);
    } else {
        next = [entry, ...bookmarks];
    }
    setBookmarks(next);
    return next;
};
