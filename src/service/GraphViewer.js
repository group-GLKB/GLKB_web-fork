// Contract from gkb2_frontend xuteng/react, GraphViewerQueryDialog.js.
// Independent client: never forward GLKB authentication to a different backend.
import axios from 'axios';
export const GRAPH_VIEWER_API_URL = process.env.REACT_APP_GRAPH_VIEWER_API_URL
    || 'https://jieliulab3.dcmb.med.umich.edu/gkb0708/api/graph';
const client = axios.create({ baseURL: '', withCredentials: false });

// Match GKB's get_node_type: Neo4j label order is not meaningful.
const TYPE_PRIORITY = ['Gene', 'Transcript', 'TSS_segment', 'Exon', 'CDS_segments',
    'UTR_segments', 'Protein', 'GO_term'];
const GENERIC_LABELS = new Set(['ontology', 'coding_element', 'coding_elements']);
export const viewerNodeType = (labels, fallback = 'Entity') => {
    const values = (Array.isArray(labels) ? labels : labels ? [labels] : []).filter(Boolean).map(String);
    return TYPE_PRIORITY.find(type => values.some(label => label.toLowerCase() === type.toLowerCase()))
        || values.find(label => !GENERIC_LABELS.has(label.toLowerCase())) || values[0] || fallback;
};

export const normalizeViewerGraph = (payload) => {
    if (payload?.error) throw new Error(payload.error.message || String(payload.error));
    const graph = payload?.combined_query_result || payload?.graph;
    if (!Array.isArray(graph?.nodes) || !Array.isArray(graph?.edges)) {
        throw new Error('Graph Viewer response is missing nodes/edges.');
    }
    const nodes = graph.nodes.map((node) => {
        const properties = node['~properties'] || node.data || {};
        const id = node['~id'] ?? properties.id;
        if (id == null) throw new Error('Graph Viewer returned a node without an ID.');
        return { data: { ...properties, id: String(id),
            display: properties.display || properties.name || properties.ensembl_name || properties.symbol || String(id),
            label: viewerNodeType(node['~labels'], properties.label || 'Entity'),
            frequency: Number(properties.frequency) || 0,
            n_citation: Number(properties.n_citation) || 0,
        } };
    });
    const ids = new Set(nodes.map((node) => node.data.id));
    const edges = graph.edges.map((edge, index) => {
        const properties = edge['~properties'] || edge.data || {};
        const source = String(edge['~start'] ?? properties.source);
        const target = String(edge['~end'] ?? properties.target);
        if (!ids.has(source) || !ids.has(target)) throw new Error('Graph Viewer returned a dangling edge.');
        const id = String(edge['~id'] ?? properties.id ?? `viewer-edge-${index}`);
        return { data: { ...properties, id, eid: [id], source, target,
            label: edge['~type'] || properties.label || '', weight: Number(properties.weight) || 1 } };
    });
    const coordinates = payload.xy_json || payload.coords;
    const positionedNodes = nodes.map((node) => {
        const coordinate = coordinates?.[node.data.id];
        const start = coordinate?.start_xy;
        const end = coordinate?.end_xy || start;
        if (!Array.isArray(start) || !Array.isArray(end)
            || ![start[0], start[1], end[0], end[1]].every(Number.isFinite)) return node;
        const width = Math.abs(end[0] - start[0]);
        const height = Math.abs(end[1] - start[1]);
        if (!width || !height) return node;
        return { ...node,
            data: { ...node.data, viewerWidth: width, viewerHeight: height,
                viewerLevel: coordinate.Level || (payload.core_nodes?.includes(node.data.id) ? 'Core' : 'Neighbor') },
            position: { x: (start[0] + end[0]) / 2, y: (start[1] + end[1]) / 2 } };
    });
    return { nodes: positionedNodes, edges };
};

export const requestGraphViewer = async (request, { signal } = {}) => {
    if (!Array.isArray(request?.cypher) || !request.cypher.length) {
        throw new Error('Provide at least one Graph Viewer query.');
    }
    const { data } = await client.post(GRAPH_VIEWER_API_URL, request, {
        signal, timeout: 30000, headers: { 'Content-Type': 'application/json' },
    });
    return { graph: normalizeViewerGraph(data), coordinates: data.xy_json || data.coords || null,
        edgeRoutes: data.edge_routes || null, metadata: data.metadata || null };
};
