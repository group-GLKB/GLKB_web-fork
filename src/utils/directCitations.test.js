/**
 * The rules in directCitations.js are the ones the integration guide is strict about: what
 * counts as "no bindings", when the definition block may be hidden, and the fact that the same
 * paper cited for two passages must produce two different quotes.
 */
import {
    bindMarkersToLinks,
    hrefWithoutMarker,
    indexByMarker,
    isSuspect,
    markerFromHref,
    parseDirectCitations,
    pmidFromHref,
    stripCitationsBlock,
} from './directCitations';

const RAW = [
    {
        marker: 'c1',
        pmid: '8028670',
        offsets: [389],
        quote: 'The tumour suppressor p53 is required to induce programmed cell death.',
        verified: true,
        context_type: 'abstract',
    },
    {
        marker: 'c2',
        pmid: '8028670',
        offsets: [626],
        quote: 'Induction of apoptosis by DNA damage depends strictly on p53 function.',
        verified: true,
        context_type: 'abstract',
    },
];

const BODY = 'p53 is required [8028670](https://pubmed.ncbi.nlm.nih.gov/8028670)[[c1]]. '
    + 'In that same study [8028670](https://pubmed.ncbi.nlm.nih.gov/8028670)[[c2]].';

describe('parsing', () => {
    it('keeps one entry per passage, not per paper', () => {
        const parsed = parseDirectCitations(RAW);
        expect(parsed).toHaveLength(2);
        expect(parsed.map((c) => c.pmid)).toEqual(['8028670', '8028670']);
        expect(parsed[0].quote).not.toBe(parsed[1].quote);
    });

    it('treats null and [] alike — both mean no bindings', () => {
        expect(parseDirectCitations(null)).toEqual([]);
        expect(parseDirectCitations([])).toEqual([]);
        expect(parseDirectCitations(undefined)).toEqual([]);
    });

    it('drops an entry with no marker, since nothing could address it', () => {
        expect(parseDirectCitations([{ pmid: '1', quote: 'x' }])).toEqual([]);
    });

    it('reads context_type under either spelling', () => {
        expect(parseDirectCitations([{ marker: 'c1', context_type: 'fulltext' }])[0].contextType)
            .toBe('fulltext');
        expect(parseDirectCitations([{ marker: 'c1', contextType: 'title' }])[0].contextType)
            .toBe('title');
    });
});

describe('the two kinds of unverified', () => {
    const at = (contextType) => parseDirectCitations([
        { marker: 'c1', verified: false, context_type: contextType },
    ])[0];

    it('flags a quote that was checked and not found', () => {
        expect(isSuspect(at('unverified'))).toBe(true);
    });

    it('does not flag one there was nothing to check against', () => {
        expect(isSuspect(at('no_source'))).toBe(false);
    });

    it('does not flag a verified quote', () => {
        expect(isSuspect(parseDirectCitations(RAW)[0])).toBe(false);
    });
});

describe('binding markers to their links', () => {
    const byMarker = indexByMarker(parseDirectCitations(RAW));

    it('folds each marker into the link before it', () => {
        const bound = bindMarkersToLinks(BODY, byMarker);
        expect(bound).toContain('(https://pubmed.ncbi.nlm.nih.gov/8028670#c1)');
        expect(bound).toContain('(https://pubmed.ncbi.nlm.nih.gov/8028670#c2)');
        expect(bound).not.toContain('[[c1]]');
    });

    it('leaves a marker alone when nothing is bound to it', () => {
        expect(bindMarkersToLinks(BODY, indexByMarker([]))).toBe(BODY);
    });

    it('reads the marker and the pmid back off the bound href', () => {
        const href = 'https://pubmed.ncbi.nlm.nih.gov/8028670#c2';
        expect(markerFromHref(href)).toBe('c2');
        expect(pmidFromHref(href)).toBe('8028670');
        expect(hrefWithoutMarker(href)).toBe('https://pubmed.ncbi.nlm.nih.gov/8028670');
    });

    it('reads a plain citation href unchanged', () => {
        const href = 'https://pubmed.ncbi.nlm.nih.gov/8028670';
        expect(markerFromHref(href)).toBeNull();
        expect(pmidFromHref(href)).toBe('8028670');
        expect(pmidFromHref('https://pubmed.ncbi.nlm.nih.gov/8028670/')).toBe('8028670');
    });

    it('does not touch a string with no markers in it', () => {
        const plain = 'no citations here';
        expect(bindMarkersToLinks(plain, byMarker)).toBe(plain);
    });
});

describe('the trailing Citations block', () => {
    const withBlock = `Body text.\n\n## Citations\n[[c1]]: "A quote."\n[[c2]]: "Another."`;

    it('is hidden when there are bindings to show instead', () => {
        const out = stripCitationsBlock(withBlock, parseDirectCitations(RAW));
        expect(out).toBe('Body text.');
    });

    /**
     * The case the guide is emphatic about: an answer saved before this shipped still carries
     * the block and has no bindings. Hiding it would take the passages out of the text and
     * leave nothing structured behind — the reader would lose the evidence entirely.
     */
    it('is kept when there are none, so the quotes survive as prose', () => {
        expect(stripCitationsBlock(withBlock, [])).toBe(withBlock);
        expect(stripCitationsBlock(withBlock, null)).toBe(withBlock);
    });

    it('leaves an answer that never had a block alone', () => {
        expect(stripCitationsBlock('Just an answer.', parseDirectCitations(RAW)))
            .toBe('Just an answer.');
    });

    it('does not mistake a section merely mentioning citations for the block', () => {
        const body = 'Text.\n\n## Citations and coverage\nStill body copy.';
        expect(stripCitationsBlock(body, parseDirectCitations(RAW))).toBe(body);
    });
});
