/**
 * The "answer graph" (v2): what an answer at High, Extra or Max SAYS, as a graph — built after the
 * answer by the agent (`POST /kg/answer-graph`) and served to the web through
 * `POST /api/v1/new-llm-agent/answer-graph` (the three-repo effort contract, 2026-11-05).
 *
 * The payload is AnswerGraph v1:
 *
 *   nodes  {key, name, type, glkb_id, focus, bridge, description, n_citation}
 *   edges  {id, source, target, layer: answer|bridge, relation, label, polarity, certainty,
 *           sentence, sentence_index, pmids, glkb: [{type, subtype, source, n_article}]}
 *   chain  [node keys]  the answer's main causal path, drawn left to right
 *
 * This module shapes it for drawing; it is pure so the rules can be tested without a canvas. The
 * basic graph (answerGraph.js, from GLKB's co-occurrence rows) is untouched and is what any answer
 * without a v2 graph keeps drawing.
 */
import { ANSWER_GRAPH_V2_ENABLED } from '../../config/features';
import { TYPE_LEGEND } from './answerGraph';

/* The levels whose answers get an answer graph (the three-repo effort contract, 2026-11-05). */
const V2_EFFORTS = new Set(['high', 'extra', 'max']);

/**
 * Whether an answer asks for the answer graph: High, Extra or Max, a signed-in reader, a saved
 * conversation (a numeric history id) — and off glkb.org until the owner opens it there
 * (config/features.js). Low, Medium and guests keep the basic graph.
 */
export const wantsAnswerGraphV2 = ({ effort, isGuest, historyId }) => (
    ANSWER_GRAPH_V2_ENABLED
    && V2_EFFORTS.has(effort)
    && !isGuest
    && Number.isFinite(Number(historyId))
    && Number(historyId) > 0
);

export const POLARITY = {
    positive: { color: '#1E8E5A', label: 'Increases / activates' },
    negative: { color: '#C2412D', label: 'Decreases / inhibits' },
    neutral: { color: '#7A8699', label: 'Other relation' },
};
export const CONFLICT_COLOR = '#B7791F';

const KNOWN_TYPES = new Set([...TYPE_LEGEND.map(([type]) => type), 'Other']);
const POLARITIES = new Set(['positive', 'negative', 'neutral']);
const CERTAINTIES = new Set(['established', 'suggested', 'conflicting']);

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const count = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * A v1 payload checked and normalised, or null when there is nothing worth drawing (fewer than
 * two connected nodes) or the payload is not one. Defensive on every field — the reader must
 * never see a broken graph where the basic one would have been fine — so an edge pointing at a
 * node that is not there is dropped, and so is a node left without an edge.
 */
export const normalizeAnswerGraph = (raw) => {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) {
        return null;
    }
    const nodes = new Map();
    raw.nodes.forEach((node) => {
        const key = text(node?.key);
        if (!key || nodes.has(key)) return;
        const type = text(node.type);
        nodes.set(key, {
            key,
            name: text(node.name) || key,
            type: KNOWN_TYPES.has(type) ? type : 'Other',
            glkbId: text(node.glkb_id) || null,
            focus: node.focus === true,
            bridge: node.bridge === true,
            description: text(node.description),
            nCitation: count(node.n_citation),
        });
    });
    const edges = [];
    raw.edges.forEach((edge, index) => {
        const source = text(edge?.source);
        const target = text(edge?.target);
        if (!nodes.has(source) || !nodes.has(target) || source === target) return;
        const layer = edge.layer === 'bridge' ? 'bridge' : 'answer';
        const sentence = layer === 'answer' ? text(edge.sentence) : '';
        const relation = text(edge.relation);
        edges.push({
            id: text(edge.id) || `e${index + 1}`,
            source,
            target,
            layer,
            relation,
            label: text(edge.label) || relation.replace(/_/g, ' '),
            polarity: POLARITIES.has(edge.polarity) ? edge.polarity : 'neutral',
            certainty: CERTAINTIES.has(edge.certainty) ? edge.certainty : 'established',
            sentence,
            pmids: Array.isArray(edge.pmids)
                ? [...new Set(edge.pmids.map((p) => String(p ?? '').trim()).filter((p) => /^\d+$/.test(p)))]
                : [],
            glkb: Array.isArray(edge.glkb)
                ? edge.glkb.filter((g) => g && typeof g === 'object').map((g) => ({
                    type: text(g.type),
                    subtype: text(g.subtype),
                    source: text(g.source),
                    nArticle: count(g.n_article),
                }))
                : [],
        });
    });
    const used = new Set(edges.flatMap((e) => [e.source, e.target]));
    const kept = [...nodes.values()].filter((n) => used.has(n.key));
    if (kept.length < 2 || !edges.length) return null;
    const chain = Array.isArray(raw.chain)
        ? raw.chain.map(text).filter((key, i, all) => used.has(key) && all.indexOf(key) === i)
        : [];
    return { nodes: kept, edges, chain };
};

/** Whether the graph has a GLKB bridge layer at all (the legend's toggle is shown only then). */
export const hasBridge = (graph) => (graph?.edges || []).some((e) => e.layer === 'bridge');

/** The part drawn with the bridge layer on or off: off hides bridge edges and bridge-only nodes. */
export const visibleGraph = (graph, showBridge) => {
    if (!graph) return { nodes: [], edges: [], chain: [] };
    if (showBridge) return graph;
    const edges = graph.edges.filter((e) => e.layer !== 'bridge');
    const used = new Set(edges.flatMap((e) => [e.source, e.target]));
    const nodes = graph.nodes.filter((n) => used.has(n.key));
    return { nodes, edges, chain: graph.chain.filter((key) => used.has(key)) };
};

/** An edge's drawn label: its words, and a small GLKB mark when GLKB has the relation too. */
export const edgeLabel = (edge) => (edge.glkb.length ? `${edge.label} · GLKB` : edge.label);

/**
 * fcose's placement constraints for the chain: each link left of the next, all on one row. Only
 * the chain's nodes that are drawn take part, and only a chain of two or more.
 */
export const chainConstraints = (chain, nodeKeys, gap = 140) => {
    const drawn = new Set(nodeKeys);
    const keys = (chain || []).filter((key) => drawn.has(key));
    if (keys.length < 2) return {};
    return {
        relativePlacementConstraint: keys.slice(1).map((key, i) => ({ left: keys[i], right: key, gap })),
        alignmentConstraint: { horizontal: [keys] },
    };
};

/** A GLKB relation as a reader would say it, with its source and how many papers back it. */
export const glkbSupportText = (rel) => {
    const raw = rel.subtype || rel.type || '';
    const words = raw === 'ppi' ? 'Protein–protein interaction'
        : raw.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
    const source = rel.source === 'primekg' ? 'PrimeKG' : rel.source;
    const papers = rel.nArticle ? `${rel.nArticle.toLocaleString('en-US')} article${rel.nArticle === 1 ? '' : 's'}` : '';
    return [words || 'Related in GLKB', source, papers].filter(Boolean).join(' · ');
};

export const CERTAINTY_TEXT = {
    established: '',
    suggested: 'The answer suggests this rather than states it.',
    conflicting: 'The evidence on this is conflicting.',
};

/** A paper's PMID as the answer's reference list carries it (`pmid`, or the PubMed URL). */
export const pmidOfReference = (ref) => {
    if (ref?.pmid) return String(ref.pmid);
    const match = /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/.exec(String(ref?.url || ''));
    return match ? match[1] : '';
};
