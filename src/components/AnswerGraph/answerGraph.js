/**
 * The knowledge graph drawn inside an answer: data shaping and sizing.
 *
 * Input is what GLKB returns for the answer's `kg_query_list` (glkb-agent
 * docs/kg-query-list-handoff.md): rows of Neo4j Query API v2 objects, each row a
 * `{nodes, edges}` pair. Three things about that shape matter here:
 *
 *   - a node's `labels` is its whole inheritance chain ("Entity", "NamedThing", ...,
 *     "Gene", "Vocabulary"), so the type is the first label we have a style for, not
 *     `labels[0]`;
 *   - edges point at `elementId`s, not at `properties.id`;
 *   - the same pair comes back several times (Cooccur both ways, Similar both ways,
 *     a curated association), so pairs are merged before drawing.
 *
 * The design (Figma "KG 4-3") draws at most two lines per pair: one Semantic (solid),
 * one Curated (dashed). Cooccur and Similar are semantic; every other relationship
 * type — PrimeKG associations, ontology links — is curated.
 */
import { NODE_STYLES } from '../Graph/nodeStyle';

/** Labels a node's chain may end in that our palette knows under another name. */
const LABEL_ALIASES = {
    Disease: 'DiseaseOrPhenotypicFeature',
    PhenotypicFeature: 'DiseaseOrPhenotypicFeature',
    BiologicalProcess: 'BiologicalProcessOrActivity',
    OrganismTaxon: 'Organism',
};

/** Legend wording and order, from the design; types it does not name follow. */
export const TYPE_LEGEND = [
    ['Gene', 'Genes'],
    ['SequenceVariant', 'Variants'],
    ['DiseaseOrPhenotypicFeature', 'Diseases / Phenotypes'],
    ['ChemicalEntity', 'Chemicals / Drugs'],
    ['MeshTerm', 'MeSH terms'],
    ['Pathway', 'Pathways'],
    ['BiologicalProcessOrActivity', 'Biological processes'],
    ['MolecularFunction', 'Molecular functions'],
    ['CellularComponent', 'Cellular components'],
    ['AnatomicalEntity', 'Anatomy'],
    ['Organism', 'Organisms'],
    ['Article', 'Literature / Content'],
];
const LEGEND_NAME = Object.fromEntries(TYPE_LEGEND);
export const typeName = (type) => LEGEND_NAME[type] || type;

export const SEMANTIC_TYPES = new Set(['Cooccur', 'Similar']);
export const edgeKind = (relType) => (SEMANTIC_TYPES.has(relType) ? 'semantic' : 'curated');

export const nodeType = (labels = []) => {
    for (const label of labels) {
        const key = LABEL_ALIASES[label] || label;
        if (NODE_STYLES[key]) return key;
    }
    return 'Article'; // nodeStyle draws anything unrecognised as literature too
};

const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** A curated relationship as a reader would say it: "ppi" -> "Protein interaction". */
const CURATED_WORDS = {
    ppi: 'Protein–protein interaction',
    'associated with': 'Associated with',
};
export const curatedLabel = (rel) => {
    const raw = rel.subtype || rel.type || '';
    return CURATED_WORDS[raw] || raw.replace(/([a-z])([A-Z])/g, '$1 $2');
};

/**
 * Query rows -> `{nodes, edges}` ready to draw.
 * nodes: {id, name, type, description, nCitation}
 * edges: {id, source, target, kind, semantic?: {nArticle, similar}, curated?: [{type, subtype, source}]}
 */
export const graphFromRows = (rows = []) => {
    const byElement = new Map();
    const nodes = new Map();
    for (const row of rows) {
        for (const node of row?.nodes || []) {
            const props = node.properties || {};
            if (!props.id) continue;
            byElement.set(node.elementId, props.id);
            if (!nodes.has(props.id)) {
                nodes.set(props.id, {
                    id: props.id,
                    name: props.name || props.id,
                    type: nodeType(node.labels),
                    description: props.description || '',
                    nCitation: Number(props.n_citation) || 0,
                });
            }
        }
    }
    const pairs = new Map();
    for (const row of rows) {
        for (const edge of row?.edges || []) {
            const source = byElement.get(edge.startNodeElementId);
            const target = byElement.get(edge.endNodeElementId);
            if (!source || !target || source === target) continue;
            const kind = edgeKind(edge.type);
            const key = `${pairKey(source, target)}|${kind}`;
            const props = edge.properties || {};
            let merged = pairs.get(key);
            if (!merged) {
                const [a, b] = source < target ? [source, target] : [target, source];
                merged = { id: key, source: a, target: b, kind };
                if (kind === 'semantic') merged.semantic = { nArticle: 0, similar: false, cooccur: false };
                else merged.curated = [];
                pairs.set(key, merged);
            }
            if (kind === 'semantic') {
                if (edge.type === 'Similar') merged.semantic.similar = true;
                if (edge.type === 'Cooccur') {
                    merged.semantic.cooccur = true;
                    merged.semantic.nArticle = Math.max(merged.semantic.nArticle, Number(props.n_article) || 0);
                }
            } else {
                const rel = { type: edge.type, subtype: props.type || '', source: props.source || '' };
                if (!merged.curated.some((r) => r.type === rel.type && r.subtype === rel.subtype)) {
                    merged.curated.push(rel);
                }
            }
        }
    }
    return { nodes: [...nodes.values()], edges: [...pairs.values()] };
};

/** The types present, in legend order. */
export const presentTypes = (nodes) => {
    const seen = new Set(nodes.map((n) => n.type));
    const ordered = TYPE_LEGEND.map(([type]) => type).filter((type) => seen.has(type));
    return [...ordered, ...[...seen].filter((type) => !LEGEND_NAME[type])];
};

/**
 * The card's size class for a given width. The design draws four frames — 336x252 (phone),
 * 464x336, 664x496 and 944x624 — so the canvas is ~4:3 up to the widest, which is 3:2, and
 * the legend changes form: below the canvas as chips on a phone, a compact two-row panel at
 * the narrow desktop size, one row from 600px up.
 */
export const cardLayout = (width) => {
    const w = Math.max(0, Number(width) || 0);
    if (w < 420) return { size: 'sm', height: Math.round(w * 0.75), legend: 'below' };
    if (w < 600) return { size: 'md', height: Math.round(w * 0.724), legend: 'compact' };
    if (w < 820) return { size: 'lg', height: Math.round(w * 0.747), legend: 'full' };
    return { size: 'xl', height: Math.round(w * 0.661), legend: 'full' };
};

/** Pull the vocabulary ids out of a kg_query_list (the `WITH [...] AS node_ids` literal). */
export const idsFromQueryList = (queries = []) => {
    const ids = [];
    for (const query of queries) {
        const match = /WITH\s+(\[[^\]]*\])\s+AS\s+node_ids/i.exec(String(query || ''));
        if (!match) continue;
        try {
            for (const id of JSON.parse(match[1])) if (typeof id === 'string' && !ids.includes(id)) ids.push(id);
        } catch { /* not a literal list; skip it */ }
    }
    return ids;
};

/**
 * Co-occurrence links almost every pair of an answer's entities (the 7-entity demo answer
 * has 20 of 21 pairs), which draws as a hairball. Keep every curated edge, and of the
 * semantic ones only each node's `perNode` strongest (by articles co-mentioning the pair;
 * Similar-only links rank last): an edge stays if it is among the strongest of EITHER end.
 */
export const sparsify = ({ nodes, edges }, perNode = 2) => {
    const strength = (e) => (e.semantic.nArticle || 0) + (e.semantic.similar ? 0.5 : 0);
    const keep = new Set();
    for (const node of nodes) {
        edges
            .filter((e) => e.kind === 'semantic' && (e.source === node.id || e.target === node.id))
            .sort((a, b) => strength(b) - strength(a))
            .slice(0, perNode)
            .forEach((e) => keep.add(e.id));
    }
    return { nodes, edges: edges.filter((e) => e.kind === 'curated' || keep.has(e.id)) };
};

const NOT_PROSE = /^(#{1,6}\s|[-*+]\s|\d+[.)]\s|\||>|```|~~~|-{3,}\s*$|\*{3,}\s*$|<)/;

/**
 * Where an answer's graph goes in its text: after the first paragraph of prose — the
 * answer's own summary, before it goes into detail — so the picture of what the answer is
 * about sits next to the sentence that says it. Headings, lists, tables, quotes and code
 * are skipped (a graph between a heading and its body, or inside a list, reads as broken).
 * An answer with no such paragraph, or whose only one is its last block, gets the graph at
 * its end. Returns `[head, tail]`; `tail` may be empty.
 */
export const splitAnswerForGraph = (markdown) => {
    const text = String(markdown || '');
    const lines = text.split('\n');
    let fence = false;
    let blockStart = -1;
    for (let i = 0; i <= lines.length; i += 1) {
        const line = i < lines.length ? lines[i] : '';
        if (/^\s*(```|~~~)/.test(line)) fence = !fence;
        const blank = i === lines.length || (!fence && !line.trim());
        if (!blank && blockStart < 0) blockStart = i;
        if (blank && blockStart >= 0) {
            const first = lines[blockStart].trim();
            if (!NOT_PROSE.test(first)) {
                const head = lines.slice(0, i).join('\n');
                const tail = lines.slice(i).join('\n').trim();
                return tail ? [head, tail] : [text, ''];
            }
            blockStart = -1;
        }
    }
    return [text, ''];
};
