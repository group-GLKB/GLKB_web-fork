/**
 * When the address bar may be rewritten to name the open conversation.
 *
 * The agent is mounted persistently — Layout keeps it alive behind every other page so a run
 * survives navigation — so an effect inside it runs on the home page, Library, History and
 * everywhere else, not only on the chat page.
 *
 * That broke New Chat. The sidebar's "New Chat" goes to `/` (it is `to: '/'`, not a chat
 * URL); the agent then restored the most recent conversation into `activeConversationId`,
 * and the URL-sync effect navigated straight into it. The reader was returned to the
 * conversation they had just left and could not reach an empty one at all.
 *
 * These are the conditions the effect applies, in the order it applies them.
 */

const shouldSyncUrl = ({ pathname, activeConversationId, routePublicId, publicId }) => {
    if (!pathname.startsWith('/chat')) return false;   // another page is showing
    if (!activeConversationId) return false;           // nothing open to name
    if (routePublicId) return false;                   // the URL already names one
    if (!publicId) return false;                       // the row has no public id yet
    return true;
};

const OPEN = { activeConversationId: '42', routePublicId: undefined, publicId: 'uuid-1' };

describe('the URL-sync effect', () => {
    it('names the conversation once it is open on a bare /chat', () => {
        expect(shouldSyncUrl({ ...OPEN, pathname: '/chat' })).toBe(true);
    });

    it('leaves the home page alone, which is where New Chat sends the reader', () => {
        expect(shouldSyncUrl({ ...OPEN, pathname: '/' })).toBe(false);
    });

    it.each(['/history', '/library', '/search', '/account', '/about'])(
        'leaves %s alone too — the agent is mounted behind all of them',
        (pathname) => {
            expect(shouldSyncUrl({ ...OPEN, pathname })).toBe(false);
        },
    );

    it('does not rewrite a URL that already names a conversation', () => {
        expect(shouldSyncUrl({
            ...OPEN, pathname: '/chat/uuid-9', routePublicId: 'uuid-9',
        })).toBe(false);
    });

    it('waits until there is a conversation to name', () => {
        expect(shouldSyncUrl({ ...OPEN, pathname: '/chat', activeConversationId: null }))
            .toBe(false);
    });

    it('leaves a row the backend has not given a public id', () => {
        expect(shouldSyncUrl({ ...OPEN, pathname: '/chat', publicId: null })).toBe(false);
    });
});
