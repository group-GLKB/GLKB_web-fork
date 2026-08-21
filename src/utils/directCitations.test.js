/**
 * The rules in directCitations.js are the ones the integration guide is strict about: what
 * counts as "no bindings", when the definition block may be hidden, and the fact that the same
 * paper cited for two passages must produce two different quotes.
 */
import {
    bindMarkersToLinks,
    citationsFor,
    hrefWithoutMarker,
    indexByMarker,
    isSuspect,
    markerFromHref,
    parseCitationsBlock,
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
    const withBlock = `Body text.\n\n## Citations\n[[c1]]: \"A quote.\"\n[[c2]]: \"Another.\"`;

    it('is hidden so the answer does not end in a wall of quotes', () => {
        expect(stripCitationsBlock(withBlock)).toBe('Body text.');
    });

    /**
     * The guide asks for this to be conditional on there being bindings, so a pre-feature
     * answer keeps its quotes as prose. It cannot be, here: the body is also run through the
     * app's unresolved-marker strip, so by the time the block is rendered its `[[cN]]:` labels
     * are gone and the quotes have run together behind dangling colons. Nothing is preserved
     * by keeping it, so it goes whether or not anything was bound.
     */
    it('goes with no bindings too, because the fallback is unreadable here', () => {
        expect(stripCitationsBlock(withBlock, [])).toBe('Body text.');
        expect(stripCitationsBlock(withBlock, null)).toBe('Body text.');
    });

    it('leaves an answer that never had a block alone', () => {
        expect(stripCitationsBlock('Just an answer.')).toBe('Just an answer.');
    });

    it('does not mistake a section merely mentioning citations for the block', () => {
        const body = `Text.\n\n## Citations and coverage\nStill body copy.`;
        expect(stripCitationsBlock(body)).toBe(body);
    });

    it('is not fooled by the word appearing mid-line', () => {
        const body = 'We checked the Citations for each claim.';
        expect(stripCitationsBlock(body)).toBe(body);
    });
});

/**
 * The deployment this app talks to emits the markers and the definition block but no
 * `direct_citations` field, so the block is the only place the passages exist. These cases are
 * taken from a real saved answer (history/357).
 */
describe('reading the bindings out of the block', () => {
    const REAL = [
        'Trends in PDAC [31197017](https://pubmed.ncbi.nlm.nih.gov/31197017)[[c1]].',
        'CAF heterogeneity [31197017](https://pubmed.ncbi.nlm.nih.gov/31197017)[[c2]].',
        '',
        '## Citations',
        '[[c1]]: "Here we use single-cell RNA sequencing to characterize the tumor microenvironment."',
        '[[c2]]: "Moreover, we describe a new population of CAFs that express MHC class II and CD74."',
    ].join('\n');

    it('gives one paper cited twice two different passages', () => {
        const found = parseCitationsBlock(REAL);
        expect(found.map((c) => c.marker)).toEqual(['c1', 'c2']);
        expect(found[0].quote).toMatch(/single-cell RNA sequencing/);
        expect(found[1].quote).toMatch(/population of CAFs/);
    });

    it('reports them unverified — nothing checked these against the papers', () => {
        parseCitationsBlock(REAL).forEach((c) => {
            expect(c.verified).toBe(false);
            expect(c.contextType).toBe('no_source');
            // ...but not the kind of unverified worth flagging to the reader
            expect(isSuspect(c)).toBe(false);
        });
    });

    it('unescapes a quote inside a quote', () => {
        const block = ['## Citations', '[[c3]]: "We discover \\"subTMEs,\\" definable states."'].join('\n');
        expect(parseCitationsBlock(block)[0].quote).toBe('We discover "subTMEs," definable states.');
    });

    it('binds those markers to their links just as the field would', () => {
        const bound = bindMarkersToLinks(REAL, indexByMarker(parseCitationsBlock(REAL)));
        expect(bound).toContain('/31197017#c1)');
        expect(bound).toContain('/31197017#c2)');
    });

    it('finds nothing in an answer with no block', () => {
        expect(parseCitationsBlock('Just prose.')).toEqual([]);
        expect(parseCitationsBlock(null)).toEqual([]);
    });

    it('ignores a line in the block that is not a definition', () => {
        const block = ['## Citations', 'stray prose', '[[c1]]: "Kept."'].join('\n');
        expect(parseCitationsBlock(block).map((c) => c.marker)).toEqual(['c1']);
    });
});

describe('choosing a source for the bindings', () => {
    const content = ['Body [[c1]].', '', '## Citations', '[[c1]]: "From the block."'].join('\n');

    it('prefers the structured field when the backend sends one', () => {
        const field = [{ marker: 'c1', pmid: '1', quote: 'From the field.', verified: true, context_type: 'abstract' }];
        const [only] = citationsFor(field, content);
        expect(only.quote).toBe('From the field.');
        expect(only.verified).toBe(true);
    });

    it('falls back to the block when it does not', () => {
        expect(citationsFor(null, content)[0].quote).toBe('From the block.');
        expect(citationsFor([], content)[0].quote).toBe('From the block.');
    });

    it('has nothing to offer when neither exists', () => {
        expect(citationsFor(null, 'Just prose.')).toEqual([]);
    });
});
