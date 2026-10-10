import {
    cardLayout, curatedLabel, edgeKind, graphFromRows, idsFromQueryList, nodeType, presentTypes, sparsify,
    splitAnswerForGraph,
} from './answerGraph';
import fixture from './demoFixture.json';

const node = (eid, id, name, labels) => ({ elementId: eid, labels, properties: { id, name } });
const edge = (type, s, t, properties = {}) => ({ type, startNodeElementId: s, endNodeElementId: t, properties });

describe('nodeType', () => {
    it('skips the inheritance chain to the first label with a style', () => {
        expect(nodeType(['Entity', 'NamedThing', 'BiologicalEntity', 'Gene', 'Vocabulary'])).toBe('Gene');
        expect(nodeType(['NamedThing', 'DiseaseOrPhenotypicFeature', 'Disease', 'Vocabulary'])).toBe('DiseaseOrPhenotypicFeature');
        expect(nodeType(['NamedThing', 'MeshTerm', 'Vocabulary'])).toBe('MeshTerm');
    });
    it('maps aliases and falls back to literature', () => {
        expect(nodeType(['Entity', 'Disease'])).toBe('DiseaseOrPhenotypicFeature');
        expect(nodeType(['Entity', 'Vocabulary'])).toBe('Article');
    });
});

describe('graphFromRows', () => {
    const rows = [{
        nodes: [
            node('e1', 'hgnc:11998', 'TP53', ['Entity', 'Gene', 'Vocabulary']),
            node('e2', 'hgnc:6973', 'MDM2', ['Entity', 'Gene', 'Vocabulary']),
        ],
        edges: [
            edge('Cooccur', 'e1', 'e2', { n_article: 900 }),
            edge('Cooccur', 'e2', 'e1', { n_article: 1200 }),
            edge('Similar', 'e2', 'e1'),
            edge('GeneToGeneAssociation', 'e2', 'e1', { type: 'ppi', source: 'primekg' }),
            edge('GeneToGeneAssociation', 'e1', 'e2', { type: 'ppi', source: 'primekg' }),
            edge('Cooccur', 'e1', 'e1'),
            edge('Cooccur', 'e1', 'missing'),
        ],
    }, {
        // the second statement repeats the nodes with no edges
        nodes: [node('e1', 'hgnc:11998', 'TP53', ['Gene'])], edges: [],
    }];

    it('merges each pair into one semantic and one curated line', () => {
        const { nodes, edges } = graphFromRows(rows);
        expect(nodes.map((n) => n.name)).toEqual(['TP53', 'MDM2']);
        expect(edges).toHaveLength(2);
        const semantic = edges.find((e) => e.kind === 'semantic');
        expect(semantic.semantic).toEqual({ nArticle: 1200, similar: true, cooccur: true });
        const curated = edges.find((e) => e.kind === 'curated');
        expect(curated.curated).toEqual([{ type: 'GeneToGeneAssociation', subtype: 'ppi', source: 'primekg' }]);
    });

    it('draws the real captured answer', () => {
        const graph = graphFromRows(fixture.rows);
        expect(graph.nodes).toHaveLength(7);
        expect(presentTypes(graph.nodes)).toEqual(['Gene', 'DiseaseOrPhenotypicFeature', 'MeshTerm']);
        // 20 of the 21 pairs co-occur, plus the PrimeKG associations
        expect(graph.edges.filter((e) => e.kind === 'semantic')).toHaveLength(20);
        const sparse = sparsify(graph);
        expect(sparse.edges.filter((e) => e.kind === 'curated')).toEqual(graph.edges.filter((e) => e.kind === 'curated'));
        expect(sparse.edges.filter((e) => e.kind === 'semantic').length).toBeLessThanOrEqual(14);
        const ids = new Set(sparse.nodes.map((n) => n.id));
        sparse.edges.forEach((e) => { expect(ids.has(e.source) && ids.has(e.target)).toBe(true); });
    });
});

describe('sparsify', () => {
    it('keeps an edge that is among the strongest of either end', () => {
        const nodes = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
        const sem = (s, t, n) => ({ id: `${s}${t}`, source: s, target: t, kind: 'semantic', semantic: { nArticle: n, similar: false } });
        const edges = [sem('a', 'b', 50), sem('a', 'c', 40), sem('a', 'd', 1), sem('b', 'c', 2), sem('c', 'd', 3)];
        const kept = sparsify({ nodes, edges }, 1).edges.map((e) => e.id);
        expect(kept).toEqual(expect.arrayContaining(['ab', 'ac', 'cd']));
        expect(kept).not.toContain('bc');
    });
});

describe('cardLayout', () => {
    it('matches the four design frames', () => {
        expect(cardLayout(336)).toEqual({ size: 'sm', height: 252, legend: 'below' });
        expect(cardLayout(464)).toEqual({ size: 'md', height: 336, legend: 'compact' });
        expect(cardLayout(664)).toEqual({ size: 'lg', height: 496, legend: 'full' });
        expect(cardLayout(944)).toEqual({ size: 'xl', height: 624, legend: 'full' });
    });
});

describe('helpers', () => {
    it('classifies relationship types', () => {
        expect(edgeKind('Cooccur')).toBe('semantic');
        expect(edgeKind('Similar')).toBe('semantic');
        expect(edgeKind('GeneToDiseaseAssociation')).toBe('curated');
        expect(curatedLabel({ type: 'GeneToGeneAssociation', subtype: 'ppi' })).toBe('Protein–protein interaction');
        expect(curatedLabel({ type: 'HierarchicalStructure', subtype: '' })).toBe('Hierarchical Structure');
    });
    it('reads the ids out of a kg_query_list', () => {
        expect(idsFromQueryList(fixture.kg_query_list)).toEqual(
            ['hgnc:11998', 'hgnc:6973', 'hgnc:1100', 'mondo:0007254', 'mesh:D004260', 'mesh:D011960', 'mesh:D017209']);
        expect(idsFromQueryList(['MATCH (n) RETURN n', null])).toEqual([]);
    });
});

describe('splitAnswerForGraph', () => {
    it('puts the graph after the first paragraph of prose', () => {
        const md = 'TP53 is restrained by MDM2.\n\n**MDM2 switches off p53.** Detail.\n\nMore.';
        expect(splitAnswerForGraph(md)).toEqual(['TP53 is restrained by MDM2.', '**MDM2 switches off p53.** Detail.\n\nMore.']);
    });
    it('skips headings, lists, tables and code to the first prose paragraph', () => {
        const md = '## Direct answer\n\n- one\n- two\n\n| a | b |\n|---|---|\n\n```\nx\n\ny\n```\n\nThe summary.\n\nThe rest.';
        const [head, tail] = splitAnswerForGraph(md);
        expect(head.endsWith('The summary.')).toBe(true);
        expect(tail).toBe('The rest.');
    });
    it('puts the graph at the end when there is nowhere better', () => {
        expect(splitAnswerForGraph('Only one paragraph.')).toEqual(['Only one paragraph.', '']);
        expect(splitAnswerForGraph('## Title\n\n- a\n- b')).toEqual(['## Title\n\n- a\n- b', '']);
        expect(splitAnswerForGraph('')).toEqual(['', '']);
    });
});
