/**
 * The effort preference and the catalogue helpers behind the Quick chip.
 *
 * Standard is the absence of a choice, so it is never stored and never sent; a level that fixes
 * its model is what tells the composer to lock the picker and drop `model` from the request.
 */
import {
    CHAT_EFFORT_KEY,
    effortsFor,
    defaultModelFor,
    getEffortPref,
    isQuickAvailable,
    setEffortPref,
    subscribeToEffortPref,
} from './effort';

const EFFORTS = [
    { id: 'quick', label: 'Quick', pipelines: ['chat'], default_model: 'gpt-5.6-luna', max_tool_rounds: 2 },
    { id: 'standard', label: 'Standard', pipelines: ['chat', 'deep_research'], default_model: null },
];

beforeEach(() => {
    window.localStorage.clear();
});

describe('the preference', () => {
    it('is empty until the reader chooses', () => {
        expect(getEffortPref()).toBe('');
    });

    it('remembers quick across a reload', () => {
        setEffortPref('quick');
        expect(window.localStorage.getItem(CHAT_EFFORT_KEY)).toBe('quick');
        expect(getEffortPref()).toBe('quick');
    });

    it('treats standard as no choice, however it is spelled', () => {
        setEffortPref('quick');
        setEffortPref('standard');
        expect(window.localStorage.getItem(CHAT_EFFORT_KEY)).toBeNull();
        expect(getEffortPref()).toBe('');

        // An old row that spelled the default out reads as no choice too.
        window.localStorage.setItem(CHAT_EFFORT_KEY, 'standard');
        expect(getEffortPref()).toBe('');
    });

    it('tells subscribers in this tab about a change', () => {
        const seen = [];
        const stop = subscribeToEffortPref((value) => seen.push(value));
        setEffortPref('quick');
        setEffortPref('');
        stop();
        setEffortPref('quick');
        expect(seen).toEqual(['quick', '']);
    });
});

describe('the catalogue helpers', () => {
    it('offers quick on chat and not on deep research', () => {
        expect(effortsFor(EFFORTS, 'chat').map((e) => e.id)).toEqual(['quick', 'standard']);
        expect(effortsFor(EFFORTS, 'deep_research').map((e) => e.id)).toEqual(['standard']);
        expect(isQuickAvailable(EFFORTS, 'chat')).toBe(true);
        expect(isQuickAvailable(EFFORTS, 'deep_research')).toBe(false);
    });

    it('offers nothing when the agent predates the field', () => {
        // No `efforts` in the catalogue means no chip: a level the request path would ignore
        // is a promise the product cannot keep.
        expect(isQuickAvailable(undefined)).toBe(false);
        expect(isQuickAvailable([])).toBe(false);
    });

    it("names a level's default model, and nothing for a level with no preference", () => {
        // A default the picker SHOWS, not a lock: the request still carries whatever the
        // picker ends up on, and the agent honours an explicit choice at any level.
        expect(defaultModelFor(EFFORTS, 'quick')).toBe('gpt-5.6-luna');
        expect(defaultModelFor(EFFORTS, 'standard')).toBe('');
        expect(defaultModelFor(EFFORTS, '')).toBe('');
        expect(defaultModelFor([], 'quick')).toBe('');
    });
});
