import {
    STOPPED_BY_USER_TEXT,
    keepsWhatItWrote,
    stoppedMessageFor,
    withStoppedMessage,
} from './stopped';

const user = { role: 'user', content: 'Which gene?' };
const empty = { role: 'assistant', content: '' };
const partial = { role: 'assistant', content: 'EGFR is the clearest case because' };

describe('what a stopped run leaves on screen', () => {
    it('names the product the reader was using', () => {
        expect(stoppedMessageFor(true)).toBe(STOPPED_BY_USER_TEXT.investigate);
        expect(stoppedMessageFor(false)).toBe(STOPPED_BY_USER_TEXT.chat);
        // Calling a stopped chat turn an "investigation" is how the first version got noticed.
        expect(stoppedMessageFor(true)).not.toBe(stoppedMessageFor(false));
    });

    it('answers an empty bubble, which is all a stopped investigation leaves', () => {
        const next = withStoppedMessage([user, empty], { investigate: true });
        expect(next[1].content).toBe(STOPPED_BY_USER_TEXT.investigate);
    });

    it('keeps partial text rather than writing a notice over it', () => {
        const messages = [user, partial];
        expect(withStoppedMessage(messages, { investigate: false })).toBe(messages);
        expect(keepsWhatItWrote(messages)).toBe(true);
    });

    it('returns the same array when there is nothing to answer', () => {
        const onlyUser = [user];
        expect(withStoppedMessage(onlyUser, { investigate: true })).toBe(onlyUser);
        expect(withStoppedMessage([], {})).toEqual([]);
    });

    it('carries the caller‘s own fields onto the stopped turn', () => {
        const next = withStoppedMessage([user, empty], {
            investigate: false,
            patch: { thinkingSteps: [{ step: 'Searching' }], thoughtDurationMs: 1200 },
        });
        expect(next[1].thoughtDurationMs).toBe(1200);
        expect(next[1].thinkingSteps).toHaveLength(1);
        expect(next[1].content).toBe(STOPPED_BY_USER_TEXT.chat);
    });
});
