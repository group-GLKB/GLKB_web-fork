import {
    ABOUT_SEEN_KEY,
    hasSeenAbout,
    isConversationPath,
    markAboutSeen,
    shouldEnterChat,
} from './entryRoutes';

describe('whether / hands the visit on to the chat', () => {
    beforeEach(() => window.localStorage.clear());

    it('shows About to everyone until they have seen it — signed in or not', () => {
        expect(hasSeenAbout()).toBe(false);
        expect(shouldEnterChat({ isAuthenticated: true, seenAbout: hasSeenAbout(), isEntry: true })).toBe(false);
        expect(shouldEnterChat({ isAuthenticated: false, seenAbout: hasSeenAbout(), isEntry: true })).toBe(false);
    });

    it('then sends a signed-in reader entering the site to the chat, and keeps a guest on About', () => {
        markAboutSeen();
        expect(window.localStorage.getItem(ABOUT_SEEN_KEY)).toBe('1');
        expect(shouldEnterChat({ isAuthenticated: true, seenAbout: hasSeenAbout(), isEntry: true })).toBe(true);
        expect(shouldEnterChat({ isAuthenticated: false, seenAbout: hasSeenAbout(), isEntry: true })).toBe(false);
    });

    it('shows About to a signed-in reader who asked for it from inside the app, or for a section of it', () => {
        expect(shouldEnterChat({ isAuthenticated: true, seenAbout: true, isEntry: false })).toBe(false);
        expect(shouldEnterChat({ isAuthenticated: true, seenAbout: true, isEntry: true, hash: '#from-the-lab' })).toBe(false);
    });

    it('does not hold a browser that cannot store the mark on About forever', () => {
        const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
        try {
            expect(hasSeenAbout()).toBe(true);
        } finally {
            spy.mockRestore();
        }
    });
});

describe('isConversationPath', () => {
    it('is a conversation, never the chat home that shares its prefix', () => {
        expect(isConversationPath('/chat')).toBe(false);
        expect(isConversationPath('/chat/new')).toBe(true);
        expect(isConversationPath('/chat/2f6c0e8a-1b2c-4d5e-8f90-123456789abc')).toBe(true);
        expect(isConversationPath('/chatter')).toBe(false);
        expect(isConversationPath('/')).toBe(false);
    });
});
