/**
 * Where the site is entered, and which address is the chat.
 *
 *   /            About — the public landing page, also when the reader is already signed in
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
