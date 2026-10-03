import {
    ABOUT_PATH,
    ABOUT_SEEN_KEY,
    CHAT_HOME_PATH,
    entryPathFor,
    hasSeenAbout,
    isConversationPath,
    markAboutSeen,
} from './entryRoutes';

describe('where / sends a visitor', () => {
    beforeEach(() => window.localStorage.clear());

    it('sends everyone to About until they have seen it — signed in or not', () => {
        expect(hasSeenAbout()).toBe(false);
        expect(entryPathFor({ isAuthenticated: false, seenAbout: hasSeenAbout() })).toBe(ABOUT_PATH);
        expect(entryPathFor({ isAuthenticated: true, seenAbout: hasSeenAbout() })).toBe(ABOUT_PATH);
    });

    it('then sends a signed-in reader to the chat and a guest to About', () => {
        markAboutSeen();
        expect(window.localStorage.getItem(ABOUT_SEEN_KEY)).toBe('1');
        expect(entryPathFor({ isAuthenticated: true, seenAbout: hasSeenAbout() })).toBe(CHAT_HOME_PATH);
        expect(entryPathFor({ isAuthenticated: false, seenAbout: hasSeenAbout() })).toBe(ABOUT_PATH);
    });

    it('does not bounce a browser that cannot store the mark to About forever', () => {
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
