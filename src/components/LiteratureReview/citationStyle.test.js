import { buildStyle, cslFor, styleMarkdown } from './citationStyle';
import { formatCitation } from '../Units/CiteDialog/format';

const csl = (pmid, authors, year, extra = {}) => ({
    type: 'article-journal',
    PMID: pmid,
    title: `Paper ${pmid}`,
    author: authors.map(([family, given]) => ({ family, given })),
    issued: { 'date-parts': [[year, 4, 16]] },
    'container-title': 'Cell',
    'container-title-short': 'Cell',
    volume: '141',
    issue: '2',
    page: '243-54',
    DOI: `10.1/${pmid}`,
    ...extra,
});

const REFS = [
    { number: 1, pmid: '11', title: 'Paper 11', year: 2021 },
    { number: 2, pmid: '22', title: 'Paper 22', year: 2019 },
    { number: 3, pmid: '33', title: 'Paper 33', year: 2021 },
    { number: 4, pmid: '44', title: 'A paper NCBI has no record for', year: 2020, doi: '10.1/44' },
];
const RECORDS = {
    11: csl('11', [['Lee', 'Ann'], ['Park', 'Bo'], ['Kim', 'Cy']], 2021),
    22: csl('22', [['Park', 'Bo'], ['Kim', 'Cy']], 2019),
    33: csl('33', [['Lee', 'Dan'], ['Choi', 'Eun'], ['Han', 'Fay']], 2021),
};

const MD = '# A review\n\nFirst claim [1, 2]. Second claim [3–4].\n\n## References\n\n'
    + '1. Paper 11 (2021). PMID 11.\n2. Paper 22 (2019). PMID 22.\n3. Paper 33 (2021). PMID 33.\n'
    + '4. A paper NCBI has no record for (2020). PMID 44.\n\n<!-- words 6 / target 6000; cited papers 4; fabricated citations 0 -->';

it('formats AMA and Nature as their guides do', () => {
    const seven = csl('20362325', [['Bunting', 'Samuel F'], ['Callén', 'Elsa'], ['Wong', 'Nancy'],
        ['Chen', 'Hua-Tang'], ['Polato', 'Federica'], ['Gunn', 'Amanda'], ['Bothmer', 'Anne']], 2010);
    expect(formatCitation('AMA', seven)).toBe(
        'Bunting SF, Callén E, Wong N, et al. Paper 20362325. Cell. 2010;141(2):243-254. doi:10.1/20362325');
    expect(formatCitation('Nature', seven)).toBe('Bunting, S. F. et al. Paper 20362325. Cell 141, 243–254 (2010).');
    const two = csl('1', [['Bunting', 'Samuel F'], ['Callén', 'Elsa']], 2010);
    expect(formatCitation('Nature', two)).toBe('Bunting, S. F. & Callén, E. Paper 1. Cell 141, 243–254 (2010).');
});

it('keeps a numeric style\'s numbers and citation order', () => {
    const built = buildStyle(REFS, RECORDS, 'vancouver');
    expect(built.entries.map((e) => e.number)).toEqual([1, 2, 3, 4]);
    expect(built.cite([1, 2])).toBe('1,2');
    expect(built.byNumber.get(1).text).toMatch(/^Lee A, Park B, Kim C\. Paper 11\. Cell\. 2021 Apr 16;141\(2\):243-54\./);
});

it('cites author–year, alphabetically, with a and b for one author part\'s two papers of a year', () => {
    const built = buildStyle(REFS, RECORDS, 'apa');
    expect(built.byNumber.get(1).label).toBe('Lee et al., 2021a');
    expect(built.byNumber.get(3).label).toBe('Lee et al., 2021b');
    expect(built.byNumber.get(2).label).toBe('Park & Kim, 2019');
    // No record: the review's own title stands in for the authors.
    expect(built.byNumber.get(4).label).toBe('“A paper NCBI has…”, 2020');
    expect(built.cite([2, 1])).toBe('Lee et al., 2021a; Park & Kim, 2019');
    expect(built.entries.map((e) => e.number)).toEqual([4, 1, 3, 2]);
    expect(built.byNumber.get(1).text).toContain('(2021a).');
    expect(buildStyle(REFS, RECORDS, 'harvard').byNumber.get(2).label).toBe('Park and Kim, 2019');
});

it('builds a record from the review\'s own fields when NCBI has none', () => {
    expect(cslFor(REFS[3], RECORDS)).toMatchObject({ title: REFS[3].title, DOI: '10.1/44', PMID: '44', partial: true });
    expect(cslFor(REFS[0], RECORDS)).toBe(RECORDS[11]);
});

it('rewrites the markdown the exports read', () => {
    const numeric = styleMarkdown(MD, REFS, RECORDS, 'ama');
    expect(numeric).toContain('First claim [1, 2]. Second claim [3–4].');
    expect(numeric).toMatch(/\n1\. Lee A, Park B, Kim C\. Paper 11\. Cell\. 2021;141\(2\):243-254\. doi:10\.1\/11\n2\. /);
    expect(numeric.trim().endsWith('fabricated citations 0 -->')).toBe(true);

    const authorDate = styleMarkdown(MD, REFS, RECORDS, 'apa');
    expect(authorDate).toContain('First claim (Lee et al., 2021a; Park & Kim, 2019).');
    expect(authorDate).toContain('Second claim (“A paper NCBI has…”, 2020; Lee et al., 2021b).');
    const list = authorDate.split('## References')[1];
    expect(list).not.toMatch(/^\d+\. /m);
    expect(list.indexOf('A paper NCBI')).toBeLessThan(list.indexOf('Lee, A.'));
});

it('says a citation the pipeline could not match is unmatched, and lists it last', () => {
    const refs = [...REFS, { number: 5, pmid: '', title: '', year: null }];
    const built = buildStyle(refs, RECORDS, 'apa');
    expect(built.entries[built.entries.length - 1]).toMatchObject({ number: 5, unmatched: true });
    expect(built.byNumber.get(5).text).toMatch(/^Not matched to a paper/);
    expect(built.cite([5])).toBe('unmatched [5]');
    expect(buildStyle(refs, RECORDS, 'vancouver').byNumber.get(5).label).toBe('5');
});

it('drops the inline markup NCBI keeps in titles', () => {
    const tagged = csl('9', [['Sun', 'Li']], 2024, { title: 'Crotonylation of RRM2<sup>K283</sup> through SIRT7' });
    expect(formatCitation('Vancouver', tagged)).toContain('Crotonylation of RRM2K283 through SIRT7.');
});
