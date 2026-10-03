/**
 * Where the site is entered, and which address is the chat.
 *
 *   /            not a page: sends the visitor on (see RootRedirect in index.js)
 *   /about       the landing page — every new visitor's first stop
 *   /chat        the chat home: the search box a conversation starts from
 *   /chat/new    a conversation that has no address of its own yet (the moments between asking
 *                and the backend handing back a public_id); it becomes /chat/<public_id>
 *   /chat/<id>   one conversation
 *
 * `/` used to BE the chat home and `/chat` the conversation view. The two now share a prefix,
 * so "is the conversation view showing" is `/chat/` with the slash, never `startsWith('/chat')`,
 * which would also match the home.
 */
export const ABOUT_PATH = '/about';
export const CHAT_HOME_PATH = '/chat';
export const CHAT_NEW_PATH = '/chat/new';

export const isConversationPath = (pathname = '') => String(pathname).startsWith('/chat/');

/**
 * Whether this browser has been shown About since the entry change.
 *
 * Versioned on purpose: the key did not exist before, so on the release that introduced it EVERY
 * visitor — signed in or not — is sent to About once, which was the intent. Changing the suffix
 * repeats that for everyone; leave it alone otherwise.
 */
export const ABOUT_SEEN_KEY = 'glkb-about-seen-v1';

export const hasSeenAbout = () => {
    try {
        return window.localStorage.getItem(ABOUT_SEEN_KEY) === '1';
    } catch (error) {
        // Storage blocked: treat as seen, so a visitor who can never record it is not bounced
        // to About on every visit.
        return true;
    }
};

export const markAboutSeen = () => {
    try {
        window.localStorage.setItem(ABOUT_SEEN_KEY, '1');
    } catch (error) {
        // Nothing to do — see hasSeenAbout.
    }
};

/**
 * Where `/` sends a visitor: About until they have seen it once, then the chat if they are
 * signed in and About if they are not.
 */
export const entryPathFor = ({ isAuthenticated, seenAbout }) => {
    if (!seenAbout) return ABOUT_PATH;
    return isAuthenticated ? CHAT_HOME_PATH : ABOUT_PATH;
};
