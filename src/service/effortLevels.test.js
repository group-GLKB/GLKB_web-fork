/**
 * Which effort levels a question can be sent at, and what goes on the wire
 * (service/effortLevels.js; the three-repo effort contract, 2026-11-05).
 *
 * The gating is what makes the web safe to ship ahead of the backend: dev's backend has no
 * `efforts` block yet, and until it does the composers must offer Medium and Extra only — the
 * menu as it was. glkb.org keeps Low, High and Max off whatever the block says.
 */
let mockProduction = false;
jest.mock('../config/features', () => ({
    INVESTIGATE_ENABLED: true,
    isProductionSite: () => mockProduction,
}));

/* eslint-disable import/first */
import {
    DEFAULT_EFFORT,
    EFFORT_LEVELS,
    effortForRequest,
    effortForTurn,
    effortOf,
    effortPipeline,
    effortsExpanded,
    enabledEfforts,
    getEffortPref,
    isEffortEnabled,
    isGuestLockedEffort,
    messageEffort,
    setServerEfforts,
    subscribeToEffortPref,
} from './effortLevels';
/* eslint-enable import/first */

// The block as the backend sends it (glkb-backend, contract item 5), already parsed.
const BLOCK = [
    { id: 'low', pipeline: 'chat', enabled: true, guest: true, default: false, prices: {} },
    { id: 'medium', pipeline: 'chat', enabled: true, guest: true, default: true, prices: {} },
    { id: 'high', pipeline: 'chat', enabled: true, guest: false, default: false, prices: {} },
    { id: 'extra', pipeline: 'deep_research', enabled: true, guest: false, default: true, prices: {} },
    { id: 'max', pipeline: 'deep_research', enabled: true, guest: false, default: false, prices: {} },
];

beforeEach(() => {
    mockProduction = false;
    setServerEfforts(null);
    localStorage.clear();
});

describe('the menu', () => {
    it('lists the five levels with the contract\'s times', () => {
        expect(EFFORT_LEVELS.map((l) => [l.id, l.label, l.time])).toEqual([
            ['low', 'Low', '~15 s'],
            ['medium', 'Medium', '~30 s'],
            ['high', 'High', '1–2 min'],
            ['extra', 'Extra', '5–8 min'],
            ['max', 'Max', '10–20 min'],
        ]);
        expect(EFFORT_LEVELS.map((l) => effortPipeline(l.id)))
            .toEqual(['chat', 'chat', 'chat', 'deep_research', 'deep_research']);
    });
});

describe('which levels are offered', () => {
    it('without an efforts block, Medium and Extra only — the menu before 2026-11-05', () => {
        expect(enabledEfforts()).toEqual(['medium', 'extra']);
        expect(isEffortEnabled('high')).toBe(false);
        expect(effortsExpanded()).toBe(false);
    });

    it('with a block, the levels it enables', () => {
        setServerEfforts(BLOCK);
        expect(enabledEfforts()).toEqual(['low', 'medium', 'high', 'extra', 'max']);
        expect(effortsExpanded()).toBe(true);
        setServerEfforts(BLOCK.map((row) => (row.id === 'high' ? { ...row, enabled: false } : row)));
        expect(enabledEfforts()).toEqual(['low', 'medium', 'extra', 'max']);
    });

    it('on glkb.org, never Low, High or Max, whatever the block says', () => {
        mockProduction = true;
        setServerEfforts(BLOCK);
        expect(enabledEfforts()).toEqual(['medium', 'extra']);
        expect(effortsExpanded()).toBe(false);
    });

    it('re-reads a stored level the block makes available, and drops one it does not', () => {
        localStorage.setItem('glkb_effort', 'high');
        expect(getEffortPref()).toBe(DEFAULT_EFFORT);
        const heard = [];
        const unsubscribe = subscribeToEffortPref((level) => heard.push(level));
        setServerEfforts(BLOCK);
        expect(heard).toEqual(['high']);
        expect(getEffortPref()).toBe('high');
        unsubscribe();
    });
});

describe('who must sign in', () => {
    it('without a block, the deep levels (as before)', () => {
        expect(['low', 'medium', 'high', 'extra', 'max'].filter(isGuestLockedEffort)).toEqual(['extra', 'max']);
    });

    it('with one, every level it marks guest: false — High included', () => {
        setServerEfforts(BLOCK);
        expect(['low', 'medium', 'high', 'extra', 'max'].filter(isGuestLockedEffort)).toEqual(['high', 'extra', 'max']);
    });
});

describe('what a turn runs at, and what goes on the wire', () => {
    it('keeps a level of the turn\'s pipeline, else that pipeline\'s default', () => {
        expect(effortForTurn('high', false)).toBe('high');
        expect(effortForTurn('max', true)).toBe('max');
        expect(effortForTurn('high', true)).toBe('extra');
        expect(effortForTurn('max', false)).toBe('medium');
        expect(effortForTurn(undefined, false)).toBe('medium');
        expect(effortForTurn('quick', true)).toBe('extra');
    });

    it('names the level only when it is not the default', () => {
        expect(effortForRequest('low', false)).toBe('low');
        expect(effortForRequest('high', false)).toBe('high');
        expect(effortForRequest('max', true)).toBe('max');
        expect(effortForRequest('medium', false)).toBeUndefined();
        expect(effortForRequest('extra', true)).toBeUndefined();
        expect(effortForRequest('quick', false)).toBeUndefined();
        expect(effortForRequest(undefined, true)).toBeUndefined();
    });

    it('reads ids however they are spelt', () => {
        expect(effortOf(' High ')).toBe('high');
        expect(effortOf('turbo')).toBe('');
        expect(effortOf(null)).toBe('');
    });
});

describe('the level a message was asked at', () => {
    it('is its own when it has one', () => {
        expect(messageEffort({ role: 'assistant', effort: 'high' })).toBe('high');
        expect(messageEffort({ role: 'assistant', effort: 'max', investigateMode: true })).toBe('max');
    });

    it('is Extra for an Investigate answer from before efforts, and Medium for any other', () => {
        expect(messageEffort({ role: 'assistant', investigateMode: true })).toBe('extra');
        expect(messageEffort({ role: 'assistant', investigateMode: false })).toBe('medium');
        expect(messageEffort({ role: 'assistant' })).toBe('medium');
        expect(messageEffort({ role: 'assistant', effort: 'bogus', investigateMode: true })).toBe('extra');
    });
});
