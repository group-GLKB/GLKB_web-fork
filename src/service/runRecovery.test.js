import {
    clearRunInFlight,
    getRunInFlight,
    getRunsInFlight,
    getStoredSessionId,
    markRunInFlight,
    RUNS_IN_FLIGHT_KEY,
    RUN_MAX_AGE_MS,
    SESSION_ID_KEY,
    setStoredSessionId,
} from './runRecovery';

beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    jest.restoreAllMocks();
});

describe('session ids outlive the tab', () => {
    it('stores them where closing the tab does not reach', () => {
        setStoredSessionId('42', 'web_abc');
        expect(getStoredSessionId('42')).toBe('web_abc');
        // sessionStorage is what the browser throws away on close; this must not be there.
        expect(window.sessionStorage.getItem(SESSION_ID_KEY)).toBeNull();
        expect(window.localStorage.getItem(SESSION_ID_KEY)).toContain('web_abc');
    });

    it('is null for a conversation nothing was stored for', () => {
        expect(getStoredSessionId('42')).toBeNull();
        expect(getStoredSessionId(null)).toBeNull();
    });

    it('forgets one when it is cleared', () => {
        setStoredSessionId('42', 'web_abc');
        setStoredSessionId('42', null);
        expect(getStoredSessionId('42')).toBeNull();
    });

    it('keeps conversations apart', () => {
        setStoredSessionId('1', 'web_one');
        setStoredSessionId('2', 'web_two');
        expect(getStoredSessionId('1')).toBe('web_one');
        expect(getStoredSessionId('2')).toBe('web_two');
    });
});

describe('runs in flight', () => {
    it('records the address an answer can be collected at', () => {
        markRunInFlight({ conversationId: '7', sessionId: 'web_seven', kind: 'investigate' });
        expect(getRunInFlight('7')).toMatchObject({
            conversationId: '7',
            sessionId: 'web_seven',
            kind: 'investigate',
        });
    });

    it('holds several at once — a reader may have two questions running', () => {
        markRunInFlight({ conversationId: '1', sessionId: 'web_one' });
        markRunInFlight({ conversationId: '2', sessionId: 'web_two' });
        expect(getRunsInFlight().map((r) => r.conversationId).sort()).toEqual(['1', '2']);
    });

    it('keeps the start time across a re-mark, so the age check stays honest', () => {
        markRunInFlight({ conversationId: '1', sessionId: 'web_one' });
        const first = getRunInFlight('1').startedAt;
        markRunInFlight({ conversationId: '1', sessionId: 'web_one' });
        expect(getRunInFlight('1').startedAt).toBe(first);
    });

    it('does not lose the address when a later mark arrives without one', () => {
        markRunInFlight({ conversationId: '1', sessionId: 'web_one' });
        markRunInFlight({ conversationId: '1', sessionId: null });
        expect(getRunInFlight('1').sessionId).toBe('web_one');
    });

    it('forgets a run when it is cleared', () => {
        markRunInFlight({ conversationId: '1', sessionId: 'web_one' });
        clearRunInFlight('1');
        expect(getRunInFlight('1')).toBeNull();
    });

    it('records nothing for a run with no conversation behind it', () => {
        // A signed-out reader's run: real, but with no saved transcript to restore it onto.
        markRunInFlight({ conversationId: null, sessionId: 'web_guest' });
        expect(getRunsInFlight()).toEqual([]);
    });

    it('ages out a mark whose run can no longer be in flight', () => {
        markRunInFlight({ conversationId: '1', sessionId: 'web_one' });
        jest.spyOn(Date, 'now').mockReturnValue(Date.now() + RUN_MAX_AGE_MS + 1000);
        expect(getRunInFlight('1')).toBeNull();
        expect(getRunsInFlight()).toEqual([]);
    });
});

describe('storage that refuses to cooperate', () => {
    it('never throws into the code that is starting a run', () => {
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError');
        });
        expect(() => markRunInFlight({ conversationId: '1', sessionId: 'web_one' })).not.toThrow();
        expect(() => setStoredSessionId('1', 'web_one')).not.toThrow();
    });

    it('reads a corrupted record as no records at all', () => {
        window.localStorage.setItem(RUNS_IN_FLIGHT_KEY, '{ this is not json');
        expect(getRunsInFlight()).toEqual([]);
    });
});
