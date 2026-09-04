import { prioritizeRunningConversations } from './recentConversations';

const conversations = [
    { id: 'newest' },
    { id: 'running-newer' },
    { id: 'middle' },
    { id: 'running-older' },
    { id: 'oldest' },
];

const ids = (items) => items.map((item) => item.id);

describe('prioritizeRunningConversations', () => {
    it('places every running conversation before settled conversations', () => {
        const result = prioritizeRunningConversations(
            conversations,
            new Set(['running-newer', 'running-older']),
        );

        expect(ids(result)).toEqual([
            'running-newer',
            'running-older',
            'newest',
            'middle',
            'oldest',
        ]);
    });

    it('preserves the existing order inside both groups', () => {
        const result = prioritizeRunningConversations(
            conversations,
            new Set(['running-older', 'running-newer']),
        );

        expect(ids(result).slice(0, 2)).toEqual(['running-newer', 'running-older']);
        expect(ids(result).slice(2)).toEqual(['newest', 'middle', 'oldest']);
    });

    it('matches numeric conversation ids against the string run registry', () => {
        const result = prioritizeRunningConversations(
            [{ id: 1 }, { id: 2 }],
            new Set(['2']),
        );

        expect(ids(result)).toEqual([2, 1]);
    });

    it('does not mutate the source list', () => {
        const source = [...conversations];
        prioritizeRunningConversations(source, new Set(['running-older']));
        expect(source).toEqual(conversations);
    });
});
