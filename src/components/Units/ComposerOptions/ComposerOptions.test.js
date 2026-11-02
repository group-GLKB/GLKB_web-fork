/**
 * What the Options drawer's choices send. Both tools start Off, so a Chat question at the defaults
 * asks for neither. Auto means the knowledge graph on and figures off — what the chat agent was sent
 * at the old "Medium" effort. Investigate (deep research) is sent neither: it does both on its own.
 */
import {
    answerFlags,
    DEFAULT_COMPOSER_OPTIONS,
    optionsChanged,
    searchFilters,
} from './index';

describe('answerFlags', () => {
    it('sends neither the knowledge graph nor figures for the defaults in Chat', () => {
        expect(DEFAULT_COMPOSER_OPTIONS).toMatchObject({ kg: 'off', fig: 'off' });
        expect(answerFlags(DEFAULT_COMPOSER_OPTIONS)).toEqual({});
        expect(answerFlags(undefined)).toEqual({});
    });

    it('follows Off and On, and Auto leaves figures out', () => {
        expect(answerFlags({ ...DEFAULT_COMPOSER_OPTIONS, kg: 'off', fig: 'on' })).toEqual({ figures: true });
        expect(answerFlags({ ...DEFAULT_COMPOSER_OPTIONS, kg: 'on', fig: 'auto' })).toEqual({ graph: true });
        expect(answerFlags({ ...DEFAULT_COMPOSER_OPTIONS, kg: 'off', fig: 'off' })).toEqual({});
    });

    it('sends neither in Investigate, whatever was chosen', () => {
        expect(answerFlags({ ...DEFAULT_COMPOSER_OPTIONS, kg: 'on', fig: 'on' }, true)).toEqual({});
    });
});

describe('searchFilters', () => {
    it('maps the article type and the sort to what the chat request takes', () => {
        expect(searchFilters(DEFAULT_COMPOSER_OPTIONS)).toEqual({ filters: [], rankingMode: 'default' });
        expect(searchFilters({ paperType: 'Reviews only', sortBy: 'Most recent first' }))
            .toEqual({ filters: ['review'], rankingMode: 'recent' });
        expect(searchFilters({ paperType: 'Exclude reviews', sortBy: 'High impact first' }))
            .toEqual({ filters: ['non_review'], rankingMode: 'high_impact' });
    });
});

describe('optionsChanged', () => {
    it('is false at the defaults and true once anything moves', () => {
        expect(optionsChanged(DEFAULT_COMPOSER_OPTIONS)).toBe(false);
        expect(optionsChanged({ ...DEFAULT_COMPOSER_OPTIONS, fig: 'auto' })).toBe(true);
        expect(optionsChanged({ ...DEFAULT_COMPOSER_OPTIONS, kg: 'auto' })).toBe(true);
    });
});
