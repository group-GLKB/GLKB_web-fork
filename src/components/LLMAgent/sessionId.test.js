/**
 * Session ids for investigate runs.
 *
 * A clarify round can only be answered by POSTing to `/sessions/{session_id}/clarify`. Before this,
 * the frontend learned that id from a single SSE frame (`Started`); if the frame did not arrive,
 * the clarify panel rendered with no address to reply to and the user got "Clarification session
 * has expired" — while the run sat paused server-side forever, because `clarify.timeout_s` is null.
 *
 * Minting the id up front removes the dependency on that frame entirely.
 */
import { mintSessionId } from './sessionId';

describe('mintSessionId', () => {
    it('produces a usable id', () => {
        const id = mintSessionId();
        expect(typeof id).toBe('string');
        expect(id.startsWith('web_')).toBe(true);
        expect(id.length).toBeGreaterThan(8);
    });

    it('does not collide across runs', () => {
        // Two conversations sharing an id would have their clarify rounds answer each other's runs.
        const ids = new Set(Array.from({ length: 200 }, mintSessionId));
        expect(ids.size).toBe(200);
    });

    it('contains nothing that would break a URL path segment', () => {
        // It goes straight into `/sessions/{id}/clarify`.
        Array.from({ length: 50 }, mintSessionId).forEach((id) => {
            expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
            expect(encodeURIComponent(id)).toBe(id);
        });
    });

    it('still works where crypto.randomUUID is unavailable', () => {
        // Non-secure contexts (plain http on a LAN box) have no crypto.randomUUID; falling through
        // to a broken value would resurrect exactly the bug this closes.
        const original = global.crypto;
        try {
            Object.defineProperty(global, 'crypto', { value: undefined, configurable: true });
            const id = mintSessionId();
            expect(id.startsWith('web_')).toBe(true);
            expect(id.length).toBeGreaterThan(8);
            expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
        } finally {
            Object.defineProperty(global, 'crypto', { value: original, configurable: true });
        }
    });
});
