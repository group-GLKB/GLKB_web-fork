/**
 * Walking the conversation list one page at a time.
 *
 * The History page showed the newest 20 conversations and had no way to ask for more, while
 * its label — "20 search history records with GLKB" — read as a total. A reader with 60
 * conversations was told they had 20, and the other 40 were unreachable: the search box
 * filters what is loaded, so keyword search could not find them either.
 *
 * The rules live here rather than in the component so they can be tested without a browser:
 * how a page is appended (by id, so a conversation that moved between two requests is
 * updated rather than duplicated), when the list is exhausted, and what the label says.
 */

/** Append a page to the rows already on screen. Later copies win; order is preserved. */
export const appendConversationPage = (previous, page) => {
    const byId = new Map();
    for (const item of [...(previous || []), ...(page || [])]) {
        const id = String(item?.id ?? '');
        if (!id) continue;
        byId.set(id, item);
    }
    return [...byId.values()];
};

/**
 * Whether there is anything left to ask for.
 *
 * A short page means the end of the list, and so does a missing cursor — a server that does
 * not send one cannot be paged safely, and asking again would re-read the page just shown.
 */
export const isLastPage = ({ received = 0, pageSize = 20, nextCursor = null } = {}) => (
    !nextCursor || received < pageSize
);

/**
 * The line under the toolbar.
 *
 * While a search is typed the number is a match count and says so. Otherwise it is "N of M"
 * until every conversation is loaded, and a plain total once they are — so the number is
 * never a page size wearing a total's clothes.
 */
export const historyCountLabel = ({
    loaded = 0, total = null, filtered = 0, searching = false,
} = {}) => {
    const records = (n) => `record${n === 1 ? '' : 's'}`;
    if (searching) return `${filtered} matching ${records(filtered)}`;
    if (total != null && loaded < total) {
        return `${loaded} of ${total} search history ${records(total)} with GLKB`;
    }
    return `${filtered} search history ${records(filtered)} with GLKB`;
};
