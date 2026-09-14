import { resolveConversationMode, readSubmittedMode, recordSubmittedMode, normalizePendingMode, resolveQueuedSearchOptions } from './conversationMode';

beforeEach(() => localStorage.clear());

describe('follow-up pipeline ownership', () => {
    const research = { id: 'research', isInvestigate: true };
    const chat = { id: 'chat', isInvestigate: false };
    it('switches from Investigate to ordinary chat without leaking the old view', () => {
        expect(resolveConversationMode({ conversationId: research.id, conversation: research })).toBe(true);
        expect(resolveConversationMode({
            conversationId: chat.id, conversation: chat,
            snapshot: { conversationId: research.id, investigate: true },
            messages: [{ investigateMode: true }],
        })).toBe(false);
    });
    it('restores Investigate from server history without a local marker', () => {
        expect(resolveConversationMode({ conversationId: research.id, conversation: research })).toBe(true);
    });
    it('rejects a stale conversation object while restoring a different chat', () => {
        expect(resolveConversationMode({ conversationId: chat.id, conversation: research })).toBe(false);
    });
    it('keeps a provisional run and a guest follow-up in their own mode', () => {
        expect(resolveConversationMode({ messages: [{ investigateMode: true }] })).toBe(true);
        expect(resolveConversationMode({ snapshot: { conversationId: null, investigate: true } })).toBe(true);
        expect(resolveConversationMode({ snapshot: { conversationId: research.id, investigate: true } })).toBe(false);
    });
    it('does not let a legacy snapshot promote an explicitly ordinary conversation', () => {
        expect(resolveConversationMode({ conversationId: chat.id, conversation: chat,
            snapshot: { conversationId: chat.id, investigate: true, runId: 'ordinary-run' },
            marked: true })).toBe(false);
    });
    it('uses a snapshot but not an unverified local icon marker when no server mode exists', () => {
        expect(resolveConversationMode({ conversationId: research.id,
            snapshot: { conversationId: research.id, investigate: true } })).toBe(true);
        expect(resolveConversationMode({ conversationId: research.id, marked: true })).toBe(false);
    });
    it('captures each queue entry mode independently of later view switches', () => {
        const entries = [research, chat].map((conversation) => ({
            conversationId: conversation.id,
            searchOptions: { investigateEnabled: resolveConversationMode({
                conversationId: conversation.id, conversation,
            }) },
        }));
        resolveConversationMode({ conversationId: research.id, conversation: research });
        expect(entries.map((entry) => entry.searchOptions.investigateEnabled)).toEqual([true, false]);
    });
});

it('remembers a submitted ordinary turn even when the server has an ever-investigated label', () => {
    recordSubmittedMode('a', false);
    recordSubmittedMode('b', true);
    expect(resolveConversationMode({ conversationId: 'a', conversation: { id: 'a', isInvestigate: true },
        submittedMode: readSubmittedMode('a') })).toBe(false);
    expect(readSubmittedMode('b')).toBe(true);
    expect(readSubmittedMode('missing')).toBeUndefined();
    recordSubmittedMode('b', false);
    expect(readSubmittedMode('b')).toBe(false);
});

it('uses the latest explicit submitted turn, not any older investigated message', () => {
    expect(resolveConversationMode({ conversationId: 'a', conversation: { id: 'a', isInvestigate: true,
        messages: [
            { role: 'user', investigateMode: true, modeSource: 'submitted' },
            { role: 'assistant', investigateMode: true },
            { role: 'user', investigateMode: false, modeSource: 'submitted' },
        ] } })).toBe(false);
});

it('normalizes an old pending investigate bubble without changing earlier answers', () => {
    const messages = [{ role: 'assistant', investigateMode: true, content: 'previous' },
        { role: 'user', content: 'follow-up' }, { role: 'assistant', investigateMode: true, content: '' }];
    const next = normalizePendingMode(messages, false);
    expect(next[0]).toBe(messages[0]);
    expect(next[2].investigateMode).toBe(false);
    expect(messages[2].investigateMode).toBe(true);
});

it('repairs legacy queued flags but preserves newly captured queue intent', () => {
    const legacy = { searchOptions: { investigateEnabled: true, model: 'chosen' } };
    expect(resolveQueuedSearchOptions(legacy, false)).toEqual({ investigateEnabled: false, model: 'chosen' });
    expect(resolveQueuedSearchOptions({ ...legacy, pipelineVersion: 1 }, false).investigateEnabled).toBe(true);
});
