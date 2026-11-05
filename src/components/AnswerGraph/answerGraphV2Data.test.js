/**
 * Shaping the answer graph (v2) for drawing — answerGraphV2Data.js. The fixture is an AnswerGraph v1
 * payload as the contract (2026-11-05) defines it: a chain, a suggested and a conflicting edge,
 * a GLKB-backed edge, and one bridge node with its edge.
 */
import fixture from './answerGraphV2Fixture.json';
import {
    chainConstraints,
    edgeLabel,
    glkbSupportText,
    hasBridge,
    normalizeAnswerGraph,
    pmidOfReference,
    visibleGraph,
    wantsAnswerGraphV2,
} from './answerGraphV2Data';

const graph = normalizeAnswerGraph(fixture.answer_graph);

describe('normalizeAnswerGraph', () => {
    it('keeps the payload as drawn', () => {
        expect(graph.nodes.map((n) => n.key)).toEqual(['n1', 'n2', 'n3', 'n4', 'n5', 'n6']);
        expect(graph.nodes[0]).toMatchObject({ name: 'Metformin', type: 'ChemicalEntity', focus: true, glkbId: 'mesh:D008687', nCitation: 1234 });
        expect(graph.edges.map((e) => [e.id, e.layer, e.polarity, e.certainty])).toEqual([
            ['e1', 'answer', 'positive', 'established'],
            ['e2', 'answer', 'negative', 'established'],
            ['e3', 'answer', 'positive', 'suggested'],
            ['e4', 'answer', 'negative', 'conflicting'],
            ['e5', 'bridge', 'positive', 'established'],
        ]);
        expect(graph.edges[1].pmids).toEqual(['23456789', '34567890']);
        expect(graph.edges[0].glkb).toEqual([{ type: 'ChemicalAffectsGene', subtype: 'activation', source: 'primekg', nArticle: 1234 }]);
        expect(graph.chain).toEqual(['n1', 'n2', 'n3', 'n4']);
    });

    it('drops what it cannot draw, and reads unknown words safely', () => {
        const shaped = normalizeAnswerGraph({
            nodes: [
                { key: 'a', name: 'A', type: 'Spaceship' },
                { key: 'b', name: 'B', type: 'Gene' },
                { key: 'c', name: 'Lonely', type: 'Gene' },
            ],
            edges: [
                { id: 'x', source: 'a', target: 'b', polarity: 'sideways', certainty: 'maybe', label: '', relation: 'associated_with', pmids: ['123', 'PMID', 456, '123'] },
                { id: 'y', source: 'a', target: 'ghost' },
                { id: 'z', source: 'b', target: 'b' },
            ],
            chain: ['ghost', 'a', 'b', 'a'],
        });
        expect(shaped.nodes.map((n) => [n.key, n.type])).toEqual([['a', 'Other'], ['b', 'Gene']]);
        expect(shaped.edges).toHaveLength(1);
        expect(shaped.edges[0]).toMatchObject({ polarity: 'neutral', certainty: 'established', label: 'associated with', pmids: ['123', '456'] });
        expect(shaped.chain).toEqual(['a', 'b']);
    });

    it('is null when there is nothing worth drawing', () => {
        expect(normalizeAnswerGraph(null)).toBeNull();
        expect(normalizeAnswerGraph({ nodes: [], edges: [] })).toBeNull();
        expect(normalizeAnswerGraph({ nodes: [{ key: 'a' }, { key: 'b' }], edges: [] })).toBeNull();
        expect(normalizeAnswerGraph({ version: 1 })).toBeNull();
    });
});

describe('the bridge layer', () => {
    it('is hidden unless asked for, with the nodes only it brought', () => {
        expect(hasBridge(graph)).toBe(true);
        const off = visibleGraph(graph, false);
        expect(off.nodes.map((n) => n.key)).not.toContain('n6');
        expect(off.edges.map((e) => e.id)).toEqual(['e1', 'e2', 'e3', 'e4']);
        expect(visibleGraph(graph, true)).toBe(graph);
    });
});

describe('the chain', () => {
    it('is laid out left to right, on one row', () => {
        expect(chainConstraints(graph.chain, ['n1', 'n2', 'n3', 'n4', 'n5'])).toEqual({
            relativePlacementConstraint: [
                { left: 'n1', right: 'n2', gap: 140 },
                { left: 'n2', right: 'n3', gap: 140 },
                { left: 'n3', right: 'n4', gap: 140 },
            ],
            alignmentConstraint: { horizontal: [['n1', 'n2', 'n3', 'n4']] },
        });
    });

    it('needs two drawn links to constrain anything', () => {
        expect(chainConstraints(['n1'], ['n1'])).toEqual({});
        expect(chainConstraints(['n1', 'n9'], ['n1'])).toEqual({});
        expect(chainConstraints([], ['n1'])).toEqual({});
    });
});

describe('words', () => {
    it('marks an edge GLKB also has', () => {
        expect(edgeLabel(graph.edges[0])).toBe('activates · GLKB');
        expect(edgeLabel(graph.edges[1])).toBe('inhibits');
        expect(glkbSupportText(graph.edges[4].glkb[0])).toBe('Protein–protein interaction · PrimeKG · 321 articles');
        expect(glkbSupportText({ type: 'ChemicalAffectsGene', subtype: '', source: '', nArticle: 0 })).toBe('Chemical Affects Gene');
    });

    it('finds a reference\'s PMID', () => {
        expect(pmidOfReference({ pmid: 42 })).toBe('42');
        expect(pmidOfReference({ url: 'https://pubmed.ncbi.nlm.nih.gov/12345678/' })).toBe('12345678');
        expect(pmidOfReference({})).toBe('');
    });
});

describe('who gets one', () => {
    it('High, Extra and Max, signed in, in a saved conversation', () => {
        ['high', 'extra', 'max'].forEach((effort) => expect(wantsAnswerGraphV2({ effort, isGuest: false, historyId: '42' })).toBe(true));
    });

    it('not Low or Medium, not a guest, not an unsaved conversation', () => {
        expect(wantsAnswerGraphV2({ effort: 'medium', isGuest: false, historyId: '42' })).toBe(false);
        expect(wantsAnswerGraphV2({ effort: 'low', isGuest: false, historyId: '42' })).toBe(false);
        expect(wantsAnswerGraphV2({ effort: 'high', isGuest: true, historyId: '42' })).toBe(false);
        expect(wantsAnswerGraphV2({ effort: 'high', isGuest: false, historyId: null })).toBe(false);
        expect(wantsAnswerGraphV2({ effort: 'high', isGuest: false, historyId: 'local-1' })).toBe(false);
    });
});
