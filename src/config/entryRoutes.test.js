import { isConversationPath } from './entryRoutes';

describe('isConversationPath', () => {
    it('is a conversation, never the chat home that shares its prefix', () => {
        expect(isConversationPath('/chat')).toBe(false);
        expect(isConversationPath('/chat/new')).toBe(true);
        expect(isConversationPath('/chat/2f6c0e8a-1b2c-4d5e-8f90-123456789abc')).toBe(true);
        expect(isConversationPath('/chatter')).toBe(false);
        expect(isConversationPath('/')).toBe(false);
    });
});
