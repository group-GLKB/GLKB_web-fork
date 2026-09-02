import {
    compareByCitationsDescending,
    compareByYearAscending,
    getReferenceYear,
    sortReferences,
} from './referenceSort';

/** The panel's own shape: the citation number has to survive the reordering. */
const wrap = (refs) => refs.map((reference, originalIndex) => ({ reference, originalIndex }));
const years = (sorted) => sorted.map(({ reference }) => reference.year);

describe('getReferenceYear', () => {
    it('reads the shapes a reference actually arrives in', () => {
        expect(getReferenceYear(2019)).toBe(2019);          // Neo4j pubdate, an integer
        expect(getReferenceYear('2019')).toBe(2019);        // the PubMed enrichment
        expect(getReferenceYear('2019 Mar 15')).toBe(2019); // an NCBI pubdate string
        expect(getReferenceYear('2019-03-15')).toBe(2019);  // an ISO date
        expect(getReferenceYear('15 March 2019')).toBe(2019);
    });

    it('reaches back as far as the literature does', () => {
        expect(getReferenceYear('1809')).toBe(1809);
        expect(getReferenceYear(1923)).toBe(1923);
    });

    it('is null — not 0, not NaN — when there is no year to read', () => {
        // 0 sorts like an ancient paper; NaN poisons the comparator that receives it.
        expect(getReferenceYear(null)).toBeNull();
        expect(getReferenceYear(undefined)).toBeNull();
        expect(getReferenceYear('')).toBeNull();
        expect(getReferenceYear('in press')).toBeNull();
        expect(getReferenceYear(NaN)).toBeNull();
    });
});

describe('sorting by year', () => {
    /* The agent sends references newest-first (`ORDER BY coalesce(a.pubdate, 0) DESC`), so
       every fixture here starts in that order: a sort that quietly does nothing looks exactly
       like the bug being pinned. */
    it('puts the oldest paper first', () => {
        expect(years(sortReferences(wrap([
            { year: 2021 }, { year: 2019 }, { year: 2015 },
        ]), 'Year'))).toEqual([2015, 2019, 2021]);
    });

    it('does the same when the years are strings', () => {
        expect(years(sortReferences(wrap([
            { year: '2021' }, { year: '2019' }, { year: '2015' },
        ]), 'Year'))).toEqual(['2015', '2019', '2021']);
    });

    it('does the same when the years are full dates', () => {
        /* This is the case that broke it. `('2019 Jan' || 0) - ('2021 Mar' || 0)` is NaN, a
           NaN comparator result reads as "equal", and the whole sort became a no-op — leaving
           the agent's newest-first order on screen under a control labelled Year. */
        expect(years(sortReferences(wrap([
            { year: '2021 Mar 15' }, { year: '2019 Jan' }, { year: '2015 Dec 1' },
        ]), 'Year'))).toEqual(['2015 Dec 1', '2019 Jan', '2021 Mar 15']);
    });

    it('does the same with the shapes mixed, which is the normal case', () => {
        expect(years(sortReferences(wrap([
            { year: 2021 }, { year: '2019-01-02' }, { year: '2015' },
        ]), 'Year'))).toEqual(['2015', '2019-01-02', 2021]);
    });

    it('sends a reference with no year to the end, not the front', () => {
        // `|| 0` used to put an unresolved paper ahead of every real one.
        expect(years(sortReferences(wrap([
            { year: 2021 }, { year: null }, { year: 2015 }, { year: '' },
        ]), 'Year'))).toEqual([2015, 2021, null, '']);
    });

    it('keeps the agent\'s order within a single year', () => {
        const sorted = sortReferences(wrap([
            { year: 2019, title: 'first' },
            { year: 2019, title: 'second' },
            { year: 2015, title: 'older' },
        ]), 'Year');
        expect(sorted.map(({ reference }) => reference.title))
            .toEqual(['older', 'first', 'second']);
    });

    it('carries the citation number through the reordering', () => {
        const sorted = sortReferences(wrap([
            { year: 2021 }, { year: 2015 },
        ]), 'Year');
        expect(sorted.map(({ originalIndex }) => originalIndex)).toEqual([1, 0]);
    });

    it('is the default, so an untouched panel is already oldest-first', () => {
        expect(years(sortReferences(wrap([{ year: 2021 }, { year: 2015 }]), undefined)))
            .toEqual([2015, 2021]);
    });
});

describe('sorting by citations', () => {
    it('puts the most-cited first', () => {
        const sorted = sortReferences(wrap([
            { citation_count: 3 }, { citation_count: 90 }, { citation_count: 20 },
        ]), 'Citations');
        expect(sorted.map(({ reference }) => reference.citation_count)).toEqual([90, 20, 3]);
    });

    it('sends a reference with no count to the end', () => {
        // The PubMed enrichment sets `citation_count: 'N/A'`.
        const sorted = sortReferences(wrap([
            { citation_count: 'N/A' }, { citation_count: 5 },
        ]), 'Citations');
        expect(sorted.map(({ reference }) => reference.citation_count)).toEqual([5, 'N/A']);
    });
});

describe('the comparators on their own', () => {
    it('never return NaN, whatever they are handed', () => {
        const nasty = [undefined, null, {}, { year: {} }, { year: 'in press' }, { year: NaN }];
        nasty.forEach((a) => nasty.forEach((b) => {
            expect(Number.isNaN(compareByYearAscending(a, b))).toBe(false);
            expect(Number.isNaN(compareByCitationsDescending(a, b))).toBe(false);
        }));
    });

    it('survive an input that is not a list', () => {
        expect(sortReferences(null, 'Year')).toEqual([]);
        expect(sortReferences(undefined, 'Citations')).toEqual([]);
    });
});
