/**
 * Which conversations were investigate runs.
 *
 * History draws a microscope beside an investigate conversation and a message
 * bubble beside a plain chat (Figma 176:8230). Nothing in the list the API
 * returns says which a conversation was — a summary carries a title, two
 * timestamps and a message count, and that is all — so the app notes it down
 * when it starts the run.
 *
 * The mark is therefore local: a conversation investigated on another device,
 * or before this shipped, shows the chat icon. That is the wrong way round to
 * be wrong in only one direction, which is the best available until the
 * summary carries the flag itself — at which point delete this module and read
 * the field.
 */
const KEY = 'glkb_investigate_conversations';

const read = () => {
    try {
        const raw = JSON.parse(window.localStorage.getItem(KEY) || '[]');
        return Array.isArray(raw) ? raw.map(String) : [];
    } catch (error) {
        return [];
    }
};

export const getInvestigateConversationIds = () => new Set(read());

export const isInvestigateConversation = (id) => (
    Boolean(id) && read().includes(String(id))
);

export const markInvestigateConversation = (id) => {
    if (!id) return;
    const ids = read();
    if (ids.includes(String(id))) return;
    try {
        window.localStorage.setItem(KEY, JSON.stringify([...ids, String(id)]));
    } catch (error) {
        // a full or blocked store costs an icon, not the run
    }
};

export const forgetInvestigateConversations = (ids) => {
    const gone = new Set((Array.isArray(ids) ? ids : [ids]).map(String));
    try {
        window.localStorage.setItem(
            KEY,
            JSON.stringify(read().filter((id) => !gone.has(id))),
        );
    } catch (error) {
        // same
    }
};
