/**
 * The chat composer's half of the guest gate.
 *
 * The Agent is one component of several thousand lines with a live stream behind it, so this
 * asserts the wiring in the source rather than by rendering it: that the dock the composer
 * sits in carries the gate, and that both doors into a question — the composer and the
 * submit path a handed-over question arrives through — ask first. The gate's own behaviour
 * is covered in `Auth/guestGate.test.jsx`.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, 'index.jsx'), 'utf-8');

/** The body of a function declared as `const NAME = ...`, up to `limit` lines. */
const bodyAfter = (declaration, limit) => {
    const start = source.indexOf(declaration);
    expect(start).toBeGreaterThan(-1);
    return source.slice(start).split('\n').slice(0, limit).join('\n');
};

describe('the composer a guest sees', () => {
    it('sits inside the gated dock', () => {
        expect(source).toMatch(/<div className="composer-dock" \{\.\.\.guestGateProps\}>/);
    });

    it('takes the gate from the shared hook rather than rolling its own', () => {
        expect(source).toContain("import { useGuestGate } from '../Auth/guestGate';");
        expect(source).toMatch(/const \{ gateProps: guestGateProps, requireAuth: requireAuthToAsk \} = useGuestGate\(\);/);
    });
});

describe('every door into a question asks first', () => {
    it('refuses a submit, including one handed over from the home page', () => {
        // That question arrives in navigation state and never touches the composer, so the
        // gate on the dock cannot see it.
        expect(bodyAfter('const handleSubmit = async (e, input = null', 12))
            .toContain('if (requireAuthToAsk()) return;');
    });

    it('refuses to queue a follow-up it would never be allowed to send', () => {
        expect(bodyAfter('const submitOrQueue = useCallback(', 8))
            .toContain('if (requireAuthToAsk()) return;');
    });
});
