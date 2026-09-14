import { resolveReferenceSourceIndex } from './referenceSource';

const cited = { role: 'assistant', references: [{ title: 'paper' }] };
const empty = { role: 'assistant', references: [] };

it('falls back to the most recent cited answer when the current answer has none', () => {
    expect(resolveReferenceSourceIndex([cited, empty, cited, empty], 3)).toBe(2);
});
it('preserves a selected older answer that has citations', () => {
    expect(resolveReferenceSourceIndex([cited, empty, cited], 0)).toBe(0);
});
it('handles initial selection, streaming answers and stale indices', () => {
    const messages = [cited, { role: 'assistant' }];
    [null, 1, 99].forEach((index) => expect(resolveReferenceSourceIndex(messages, index)).toBe(0));
});
it('does not carry references across chats or use user messages', () => {
    expect(resolveReferenceSourceIndex([], 2)).toBeNull();
    expect(resolveReferenceSourceIndex([empty, { role: 'user', references: [{}] }], 1)).toBeNull();
});
