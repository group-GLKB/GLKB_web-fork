/**
 * Should opening the chat page restore a stored conversation over what is on screen?
 *
 * The chat mount loads "the conversation you were last looking at" so a reload or a pasted
 * link lands somewhere. That restore blanks the message list while it fetches
 * (`isConversationLoading` takes `renderMessages()` off the page), so running it at the wrong
 * moment does not just waste a request — it hides whatever the reader is actually watching.
 *
 * Three things can be true at once and they disagree:
 *
 *   - the ADDRESS names a conversation. Normally the strongest statement there is: it survives
 *     the tab closing, which sessionStorage does not, and a link someone pasted means exactly
 *     one conversation.
 *   - a QUESTION is on its way — handed over from the home page, or handed over as a router
 *     state conversation id — and the page it will live in does not exist yet.
 *   - a RUN is in flight in this mount, and the live view is ahead of anything stored.
 *
 * The trap is that the address can be this component's own doing. Asking a question creates
 * the conversation row, selecting it lets the chat upgrade /chat to /chat/<public_id>, and
 * that rename re-runs the restore with an address that now looks authoritative. It then
 * reloads the conversation currently being written, which is how asking a question made the
 * question, the answer and the progress vanish behind "Loading chat history..." for as long as
 * two round trips took.
 *
 * A live stream on the conversation the address names settles it: the address is describing
 * where we already are, so there is nothing to fetch. Without a stream the restore still runs,
 * because a reload or a pasted link arrives with the same id and an empty page, and that one
 * does need loading.
 *
 * Its own module, with no imports, so the rule can be tested without pulling the whole app in.
 */

const sameId = (a, b) => (
    a != null && b != null && String(a) === String(b)
);

/**
 * @param {object}  args
 * @param {*} [args.routeConversationId]    Row id the URL resolved to, or null if the URL names none.
 * @param {*} [args.activeConversationId]   The conversation currently selected in this mount.
 * @param {*} [args.runningConversationId]  The conversation that owns the in-flight run.
 * @param {*} [args.activeStreamId]         Truthy while this mount has a stream open.
 * @param {boolean} [args.hasInitialQuery]  A question was handed over by the home page.
 * @param {boolean} [args.hasConversationId] A conversation was handed over in router state.
 * @param {boolean} [args.isInitialQueryTransition] The handover is mid-flight; its state is cleared.
 * @returns {boolean} true when the restore must stand back and leave the view alone.
 */
export const shouldSkipConversationRestore = ({
    routeConversationId = null,
    activeConversationId = null,
    runningConversationId = null,
    activeStreamId = null,
    hasInitialQuery = false,
    hasConversationId = false,
    isInitialQueryTransition = false,
} = {}) => {
    const addressedByRoute = routeConversationId != null;

    // The address bar catching up with the run already on screen. Not a request to load.
    const isOwnAddressUpgrade = addressedByRoute
        && Boolean(activeStreamId)
        && (
            sameId(routeConversationId, activeConversationId)
            || sameId(routeConversationId, runningConversationId)
        );
    if (isOwnAddressUpgrade) return true;

    // Any other address is a reader asking for that conversation, and outranks the rest.
    if (addressedByRoute) return false;

    return Boolean(
        hasInitialQuery
        || hasConversationId
        || isInitialQueryTransition
        || activeStreamId,
    );
};

export default shouldSkipConversationRestore;
