/**
 * The marker History reads to decide between the microscope and the message
 * bubble (Figma 176:8230). It is the only record of which conversations were
 * investigate runs, so its failure modes matter more than its happy path: a
 * blocked or corrupt store must cost an icon, never a render.
 */
import {
    forgetInvestigateConversations,
    getInvestigateConversationIds,
    isInvestigateConversation,
    markInvestigateConversation,
} from './investigateConversations';

const KEY = 'glkb_investigate_conversations';

beforeEach(() => window.localStorage.clear());

describe('marking', () => {
    it('remembers a conversation across reads', () => {
        markInvestigateConversation('42');
        expect(isInvestigateConversation('42')).toBe(true);
        expect(getInvestigateConversationIds().has('42')).toBe(true);
    });

    it('compares as a string, because ids arrive as both', () => {
        markInvestigateConversation(42);
        expect(isInvestigateConversation('42')).toBe(true);
    });

    it('does not grow on a repeat mark', () => {
        markInvestigateConversation('42');
        markInvestigateConversation('42');
        expect(JSON.parse(window.localStorage.getItem(KEY))).toEqual(['42']);
    });

    it('ignores a missing id rather than storing a blank', () => {
        markInvestigateConversation(null);
        markInvestigateConversation('');
        expect(window.localStorage.getItem(KEY)).toBeNull();
    });
});

describe('forgetting', () => {
    it('drops deleted conversations and keeps the rest', () => {
        ['1', '2', '3'].forEach(markInvestigateConversation);
        forgetInvestigateConversations(['1', '3']);
        expect([...getInvestigateConversationIds()]).toEqual(['2']);
    });

    it('takes a bare id as well as a list', () => {
        markInvestigateConversation('1');
        forgetInvestigateConversations('1');
        expect(isInvestigateConversation('1')).toBe(false);
    });
});

describe('a store that cannot be trusted', () => {
    it('reads nothing out of corrupt JSON', () => {
        window.localStorage.setItem(KEY, '{not json');
        expect(getInvestigateConversationIds().size).toBe(0);
    });

    it('reads nothing out of a value that is not a list', () => {
        window.localStorage.setItem(KEY, '{"a":1}');
        expect(getInvestigateConversationIds().size).toBe(0);
    });

    it('does not throw when writing is refused', () => {
        const setItem = jest.spyOn(Storage.prototype, 'setItem')
            .mockImplementation(() => { throw new Error('QuotaExceededError'); });
        expect(() => markInvestigateConversation('42')).not.toThrow();
        expect(() => forgetInvestigateConversations('42')).not.toThrow();
        setItem.mockRestore();
    });
});
