import { isExchangeUnfinished } from './resumeRun';

describe('isExchangeUnfinished', () => {
    it('is false for an empty or missing conversation', () => {
        expect(isExchangeUnfinished([])).toBe(false);
        expect(isExchangeUnfinished(null)).toBe(false);
        expect(isExchangeUnfinished(undefined)).toBe(false);
    });

    it('is false when the last message is a finished answer', () => {
        expect(isExchangeUnfinished([
            { role: 'user', content: 'What is TP53?' },
            { role: 'assistant', content: 'A tumour suppressor.' },
        ])).toBe(false);
    });

    it('is true when the prompt was saved but the answer was not', () => {
        // What the backend leaves behind mid-run: the user row exists, the assistant row does not.
        expect(isExchangeUnfinished([
            { role: 'assistant', content: 'earlier answer' },
            { role: 'user', content: 'and what about KRAS?' },
        ])).toBe(true);
    });

    it('is true for the local placeholder a run in flight leaves behind', () => {
        expect(isExchangeUnfinished([
            { role: 'user', content: 'What is TP53?' },
            { role: 'assistant', content: '' },
        ])).toBe(true);
    });

    it('treats whitespace as no answer at all', () => {
        expect(isExchangeUnfinished([
            { role: 'user', content: 'q' },
            { role: 'assistant', content: '   \n ' },
        ])).toBe(true);
    });

    it('does not trip over a malformed tail', () => {
        expect(isExchangeUnfinished([{ role: 'user', content: 'q' }, null])).toBe(false);
        expect(isExchangeUnfinished(['nonsense'])).toBe(false);
    });
});
