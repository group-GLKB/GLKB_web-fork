import { resolveConversationMode } from './conversationMode';

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
    it('uses a snapshot or local marker when no server mode exists', () => {
        expect(resolveConversationMode({ conversationId: research.id,
            snapshot: { conversationId: research.id, investigate: true } })).toBe(true);
        expect(resolveConversationMode({ conversationId: research.id, marked: true })).toBe(true);
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
