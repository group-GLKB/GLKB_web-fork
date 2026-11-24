/**
 * What the Options drawer's choices send. Both tools start Off (2026-11-02), so a question at the
 * defaults asks for neither. Auto follows the effort: the knowledge graph from Medium up, figures
 * from High up. Extra (deep research) is sent neither: it does both on its own.
 */
import {
    answerFlags,
    DEFAULT_COMPOSER_OPTIONS,
    optionsChanged,
    searchFilters,
} from './index';

describe('answerFlags', () => {
    it('sends neither the knowledge graph nor figures for the defaults at Medium', () => {
        expect(DEFAULT_COMPOSER_OPTIONS).toMatchObject({ kg: 'off', fig: 'off' });
        expect(answerFlags(DEFAULT_COMPOSER_OPTIONS, 'medium')).toEqual({});
        expect(answerFlags(undefined, 'medium')).toEqual({});
    });

    it('follows Off and On; Auto at Medium is the graph and no figures', () => {
        expect(answerFlags({ ...DEFAULT_COMPOSER_OPTIONS, kg: 'off', fig: 'on' }, 'medium')).toEqual({ figures: true });
        expect(answerFlags({ ...DEFAULT_COMPOSER_OPTIONS, kg: 'on', fig: 'auto' }, 'medium')).toEqual({ graph: true });
        expect(answerFlags({ ...DEFAULT_COMPOSER_OPTIONS, kg: 'auto', fig: 'auto' }, 'medium')).toEqual({ graph: true });
        expect(answerFlags({ ...DEFAULT_COMPOSER_OPTIONS, kg: 'off', fig: 'off' }, 'medium')).toEqual({});
    });

    it('sends neither at Extra, whatever was chosen', () => {
        expect(answerFlags({ ...DEFAULT_COMPOSER_OPTIONS, kg: 'on', fig: 'on' }, 'extra')).toEqual({});
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
