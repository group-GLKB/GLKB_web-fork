/**
 * Session ids for investigate runs.
 *
 * Its own module, with no imports: `components/LLMAgent/index.jsx` cannot be pulled into a test
 * without dragging the whole app in behind it.
 */

/**
 * Mint a session id for an investigate run that does not have one yet.
 *
 * The agent honours a client-supplied `session_id` and only invents `stream_<hex>` when we send
 * none, so choosing it here costs nothing and closes a real hole: a clarify round can ONLY be
 * answered by POSTing to `/sessions/{session_id}/clarify`. When we let the server name the
 * session, the id reaches us on exactly one frame — `Started` — and if that frame never arrives
 * (older agent build, a proxy that eats the first chunk, a parse slip) the clarify panel renders
 * with no address to reply to. The user then gets "Clarification session has expired", their
 * answers are dropped, and the run is left paused server-side: `clarify.timeout_s` is null, so it
 * waits for an answer that can no longer be sent. Knowing the id before the stream opens makes
 * that unreachable.
 *
 * `Started` still echoes the id back and the existing handler still applies it — same value.
 *
 * The `web_` prefix only distinguishes these from the agent's own `stream_` ids in logs; nothing
 * parses either one.
 */
export const mintSessionId = () => {
    const rand = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    return `web_${rand}`;
};
