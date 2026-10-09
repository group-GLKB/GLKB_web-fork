import axios from 'axios';
import { GRAPH_VIEWER_API_URL, normalizeViewerGraph, requestGraphViewer, viewerNodeType } from './GraphViewer';

jest.mock('axios', () => {
    const client = { post: jest.fn() };
    return { create: jest.fn(() => client) };
});
const client = axios.create.mock.results[0].value;
const clientConfig = axios.create.mock.calls[0][0];
const response = () => ({
    combined_query_result: {
        nodes: [
            { '~id': 'a', '~labels': ['Coding_element', 'Gene'], '~properties': { name: 'CFTR', description: 'Gene description' } },
            { '~id': 'b', '~properties': {} },
        ],
        edges: [{ '~id': 'r', '~start': 'a', '~end': 'b', '~type': 'PHYSICAL_INTERACTION', '~properties': { publication_source: 'PUBMED:123' } }],
    },
    xy_json: { a: { start_xy: [100, 22], end_xy: [220, -22] } },
});
beforeEach(() => client.post.mockReset());

it('normalizes node and edge properties without losing source IDs or descriptions', () => {
    const graph = normalizeViewerGraph(response());
    expect(graph.nodes[0]).toEqual({ data: { id: 'a', name: 'CFTR', display: 'CFTR',
        label: 'Gene', description: 'Gene description', frequency: 0, n_citation: 0,
        viewerWidth: 120, viewerHeight: 44, viewerLevel: 'Neighbor' }, position: { x: 160, y: 0 } });
    expect(graph.nodes[1].data.display).toBe('b');
    expect(graph.nodes[1].position).toBeUndefined();
    expect(graph.edges[0].data).toEqual({ id: 'r', eid: ['r'], source: 'a', target: 'b',
        label: 'PHYSICAL_INTERACTION', weight: 1, publication_source: 'PUBMED:123' });
});

it('supports the alternate graph/coords response', () => {
    const graph = normalizeViewerGraph({ graph: { nodes: [{ data: { id: 42, name: 'Gene' } }], edges: [] },
        coords: { 42: { start_xy: [0, 0], end_xy: [20, 40] } } });
    expect(graph.nodes[0].data.id).toBe('42');
    expect(graph.nodes[0].position).toEqual({ x: 10, y: 20 });
});

it('ignores invalid coordinates rather than handing NaN to Cytoscape', () => {
    const payload = response();
    payload.xy_json.a.start_xy = [null, 5];
    expect(normalizeViewerGraph(payload).nodes[0].position).toBeUndefined();
});

it.each([
    [{ error: { message: 'Query failed' } }, 'Query failed'],
    [{ error: 'Query failed' }, 'Query failed'],
    [{}, 'missing nodes/edges'],
    [{ graph: { nodes: [{}], edges: [] } }, 'without an ID'],
    [{ graph: { nodes: [], edges: [{ '~start': 'missing' }] } }, 'dangling edge'],
])('rejects malformed/failed responses %j', (payload, message) => {
    expect(() => normalizeViewerGraph(payload)).toThrow(message);
});

it('uses an independent client with cancellation and bounded timeout', async () => {
    client.post.mockResolvedValue({ data: response() });
    const request = { cypher: ['MATCH (n) RETURN n LIMIT 1'], core_nodes: [], max_nodes: 1, layout_mode: 'kg_only' };
    const signal = new AbortController().signal;
    const result = await requestGraphViewer(request, { signal });
    expect(clientConfig).toEqual({ baseURL: '', withCredentials: false });
    expect(client.post).toHaveBeenCalledWith(GRAPH_VIEWER_API_URL, request, {
        signal, timeout: 30000, headers: { 'Content-Type': 'application/json' },
    });
    expect(result.graph.nodes).toHaveLength(2);
});

it('rejects empty requests without sending them', async () => {
    await expect(requestGraphViewer({ cypher: [] })).rejects.toThrow('at least one');
    expect(client.post).not.toHaveBeenCalled();
});

it('propagates transport failures', async () => {
    client.post.mockRejectedValue(new Error('Network Error'));
    await expect(requestGraphViewer({ cypher: ['query'] })).rejects.toThrow('Network Error');
});

it.each([
    [['Gene', 'Coding_element'], 'Gene'],
    [['Coding_element', 'Gene'], 'Gene'],
    [['Ontology', 'GO_term'], 'GO_term'],
    [['Gene', 'Transcript'], 'Gene'],
    ['Transcript', 'Transcript'],
    [['Coding_element', 'Enhancer'], 'Enhancer'],
    [[], 'Entity'],
])('matches backend type selection for %j', (labels, expected) => {
    expect(viewerNodeType(labels)).toBe(expected);
});

it('preserves Core level and server rectangle dimensions', () => {
    const payload = response();
    payload.xy_json.a.Level = 'Core';
    const node = normalizeViewerGraph(payload).nodes[0];
    expect(node.data).toMatchObject({ viewerLevel: 'Core', viewerWidth: 120, viewerHeight: 44 });
});

it('preserves overflow descriptions and ensembl-name fallback', () => {
    const payload = { graph: { nodes: [{ '~id': 'overflow:1', '~labels': ['GO_term'],
        '~properties': { ensembl_name: 'GO_term ...', is_overflow: true,
            description: '32 GO_term nodes hidden due to canvas size limit' } }], edges: [] } };
    expect(normalizeViewerGraph(payload).nodes[0].data).toMatchObject({
        display: 'GO_term ...', is_overflow: true,
        description: '32 GO_term nodes hidden due to canvas size limit',
    });
});

it('passes mixed Neo4j and PGSQL query objects through unchanged', async () => {
    client.post.mockResolvedValue({ data: response() });
    const request = { cypher: [{ source: 'neo4j', query: 'MATCH (n) RETURN collect(n) AS nodes, [] AS edges LIMIT 1' },
        { source: 'pgsql', api: 'chr/features/by-node', searched_id: 'ENSG00000001626',
            relative_position: 'downstream', feature_types: ['Gene'], limit: 1 }], layout_mode: 'kg_only' };
    await requestGraphViewer(request);
    expect(client.post.mock.calls[0][1]).toBe(request);
});
