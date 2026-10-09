/**
 * Where the site is entered, and which address is the chat.
 *
 *   /            About — the landing page, and every new visitor's first stop. A signed-in reader
 *                ENTERING the site here goes on to the chat (see shouldEnterChat)
 *   /about       old address of About; redirects to /
 *   /chat        the chat home: the search box a conversation starts from
 *   /chat/new    a conversation that has no address of its own yet (the moments between asking
 *                and the backend handing back a public_id); it becomes /chat/<public_id>
 *   /chat/<id>   one conversation
 *
 * `/` used to be the chat home and `/chat` the conversation view. The two now share a prefix,
 * so "is the conversation view showing" is `/chat/` with the slash, never `startsWith('/chat')`,
 * which would also match the home.
 */
export const ABOUT_PATH = '/';
export const CHAT_HOME_PATH = '/chat';
export const CHAT_NEW_PATH = '/chat/new';

export const isConversationPath = (pathname = '') => String(pathname).startsWith('/chat/');

/**
 * Whether this browser has been shown About since the entry change.
 *
 * Versioned on purpose: the key did not exist before, so on the release that introduced it EVERY
 * visitor — signed in or not — is shown About once, which was the intent. Changing the suffix
 * repeats that for everyone; leave it alone otherwise.
 */
export const ABOUT_SEEN_KEY = 'glkb-about-seen-v1';

export const hasSeenAbout = () => {
    try {
        return window.localStorage.getItem(ABOUT_SEEN_KEY) === '1';
    } catch (error) {
        // Storage blocked: treat as seen, so a visitor who can never record it is not held on
        // About on every visit.
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
 * Whether `/` hands this visit on to the chat instead of showing About.
 *
 * Only when the reader is signed in, has seen About once, and is ENTERING the site — a typed
 * address, a bookmark, a link from outside (`isEntry`). Reaching `/` from inside the app means
 * they asked for About (the sidebar's About, the logo on the marketing pages), so it shows. A
 * `#section` link names a part of About, so that shows too.
 */
export const shouldEnterChat = ({ isAuthenticated, seenAbout, isEntry, hash = '' }) => (
    Boolean(isAuthenticated && seenAbout && isEntry && !hash)
);
