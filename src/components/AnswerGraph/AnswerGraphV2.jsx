import './AnswerGraph.css';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Cytoscape from 'cytoscape';

import { nodeStyle } from '../Graph/nodeStyle';
import { GRAPH_FONT, loadGraphFont } from '../Graph/labels';
import { wrapLabel } from '.';
import { cardLayout, presentTypes, typeName } from './answerGraph';
import {
    CERTAINTY_TEXT,
    chainConstraints,
    CONFLICT_COLOR,
    edgeLabel,
    glkbSupportText,
    hasBridge,
    pmidOfReference,
    POLARITY,
    visibleGraph,
} from './answerGraphV2Data';
import { showSentence } from './sentenceHighlight';

/* The card, canvas, legend and detail panel are the basic graph's (index.jsx, Figma "KG 4-3"),
   so the two read as one component; what differs is what the lines say. fcose is registered by
   index.jsx, which this module imports. */
const FONT_SIZE = 14;
const LINE_HEIGHT = 22;
const EDGE_FONT = 11;

const withSeededRandom = (seed, fn) => {
    const original = Math.random;
    let s = seed >>> 0 || 1;
    Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    try { return fn(); } finally { Math.random = original; }
};
const hash = (value) => [...value].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

const STYLE = [
    { selector: 'node', style: {
        shape: 'round-rectangle', width: 'data(w)', height: 'data(h)',
        'background-color': 'data(fill)', 'border-color': 'data(border)', 'border-width': 0.8,
        label: 'data(label)', color: 'data(text)', 'font-family': GRAPH_FONT, 'font-size': FONT_SIZE,
        'font-weight': 400, 'line-height': LINE_HEIGHT / FONT_SIZE, 'text-wrap': 'wrap',
        'text-max-width': 1000, 'text-valign': 'center', 'text-halign': 'center',
        'overlay-opacity': 0, 'transition-property': 'opacity', 'transition-duration': 120,
    } },
    // What the question is about stands out; a node GLKB added to bridge two others recedes.
    { selector: 'node[?focus]', style: { 'border-width': 2.4, 'font-weight': 600 } },
    { selector: 'node[?bridge]', style: { 'border-style': 'dashed', 'background-opacity': 0.7 } },
    { selector: 'node.hover, node.active', style: { 'font-weight': 600, 'border-width': 1.6 } },
    { selector: 'node[?focus].hover, node[?focus].active', style: { 'border-width': 2.8 } },
    { selector: 'edge', style: {
        width: 2, 'line-color': 'data(color)', 'curve-style': 'bezier', 'control-point-step-size': 48,
        'target-arrow-shape': 'triangle', 'target-arrow-color': 'data(color)', 'arrow-scale': 0.9,
        label: 'data(label)', color: 'data(color)', 'font-family': GRAPH_FONT, 'font-size': EDGE_FONT,
        'text-rotation': 'autorotate', 'text-background-color': '#FAFCFF', 'text-background-opacity': 0.92,
        'text-background-padding': 2, 'text-background-shape': 'roundrectangle',
        'line-cap': 'round', 'overlay-opacity': 0, 'overlay-padding': 6,
        'transition-property': 'opacity, width', 'transition-duration': 120,
    } },
    { selector: 'edge[certainty = "suggested"]', style: { 'line-style': 'dashed', 'line-dash-pattern': [6, 6] } },
    { selector: 'edge[certainty = "conflicting"]', style: {
        'mid-target-arrow-shape': 'diamond', 'mid-target-arrow-color': CONFLICT_COLOR, 'mid-target-arrow-fill': 'filled',
    } },
    { selector: 'edge[layer = "bridge"]', style: { 'line-style': 'dotted', width: 1.5 } },
    { selector: 'edge.hover, edge.active', style: { width: 3 } },
    { selector: '.faded', style: { opacity: 0.22 } },
];

/** Cytoscape elements for what is drawn: nodes styled by type, edges by polarity and certainty. */
export const buildElements = ({ nodes, edges }) => [
    ...nodes.map((n) => {
        const style = nodeStyle(n.type);
        const label = wrapLabel(n.name);
        return {
            group: 'nodes',
            data: {
                id: n.key, type: n.type, label: label.text, w: label.width, h: label.height,
                fill: style.fill, border: style.border, text: style.text, focus: n.focus, bridge: n.bridge,
            },
        };
    }),
    ...edges.map((e) => ({
        group: 'edges',
        data: {
            id: e.id, source: e.source, target: e.target, label: edgeLabel(e),
            color: POLARITY[e.polarity].color, certainty: e.certainty, layer: e.layer,
        },
    })),
];

/** The fcose run: the basic graph's settings, plus the chain left to right. */
export const layoutOptions = ({ nodes, chain }) => ({
    name: 'fcose', quality: 'proof', randomize: true, animate: false, fit: false,
    nodeDimensionsIncludeLabels: false, idealEdgeLength: () => 150, nodeRepulsion: () => 9000,
    nodeSeparation: 90, edgeElasticity: () => 0.3, gravity: 0.35, numIter: 2500,
    ...chainConstraints(chain, nodes.map((n) => n.key)),
});

const InfoIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 9v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10" cy="6.75" r="0.9" fill="currentColor" />
    </svg>
);

function Legend({ variant, graph, types, focus, onFocus, showBridge, onBridge }) {
    const polarities = ['positive', 'negative', 'neutral'].filter((p) => graph.edges.some((e) => e.polarity === p && e.layer === 'answer'));
    const suggested = graph.edges.some((e) => e.certainty === 'suggested');
    const conflicting = graph.edges.some((e) => e.certainty === 'conflicting');
    const glkb = graph.edges.some((e) => e.glkb.length);
    return (
        <div className={`ag-legend ag-legend-${variant}`}>
            <div className="ag-legend-entities">
                <div className="ag-legend-title">Entities</div>
                <div className="ag-entity-grid">
                    {types.map((type) => {
                        const style = nodeStyle(type);
                        const on = focus.has(type);
                        return (
                            <button
                                key={type} type="button" className={`ag-entity${on ? ' is-on' : ''}`}
                                style={variant === 'below' ? { background: style.fill, borderColor: style.border, color: style.text } : { color: style.text }}
                                aria-pressed={on} onClick={() => onFocus(type)}
                            >
                                {variant !== 'below' && <span className="ag-swatch" style={{ background: style.fill, borderColor: style.border }} />}
                                {typeName(type)}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="ag-legend-divider" />
            <div className="ag-legend-rels">
                <div className="ag-legend-title">What the answer says</div>
                {polarities.map((p) => (
                    <div key={p} className="ag-v2-key">
                        <span className="ag-v2-rule" style={{ borderTopColor: POLARITY[p].color }} />{POLARITY[p].label}
                    </div>
                ))}
                {suggested && <div className="ag-v2-key"><span className="ag-v2-rule is-dashed" />Suggested</div>}
                {conflicting && <div className="ag-v2-key"><span className="ag-v2-diamond" aria-hidden="true">◆</span>Conflicting evidence</div>}
                {glkb && <div className="ag-v2-key"><span className="ag-v2-glkb">GLKB</span>Also a GLKB relation</div>}
                {hasBridge(graph) && (
                    <button
                        type="button" className={`ag-kind ag-v2-bridge${showBridge ? '' : ' is-off'}`}
                        aria-pressed={showBridge} onClick={onBridge}
                    >
                        <span className="ag-v2-rule is-dotted" /><span className="ag-kind-label">GLKB indirect links</span>
                    </button>
                )}
            </div>
        </div>
    );
}

function Papers({ pmids, references }) {
    if (!pmids.length) return null;
    const numbered = new Map((references || []).map((ref, i) => [pmidOfReference(ref), { ref, number: i + 1 }]));
    return (
        <>
            <div className="ag-detail-kicker ag-v2-section">Cited papers</div>
            <ul className="ag-detail-list ag-v2-papers">
                {pmids.map((pmid) => {
                    const hit = numbered.get(pmid);
                    return (
                        <li key={pmid}>
                            <a href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`} target="_blank" rel="noopener noreferrer">
                                {hit ? `[${hit.number}] ${hit.ref.title || `PMID ${pmid}`}` : `PMID ${pmid}`}
                            </a>
                        </li>
                    );
                })}
            </ul>
        </>
    );
}

// Keyed by the selection, so "could not be found" does not outlive the edge it was about.
function Detail({ item, nodesByKey, references, onShowSentence, onClose }) {
    const [notFound, setNotFound] = useState(false);
    if (!item) return null;
    if (item.kind === 'node') {
        const n = item.node;
        const style = nodeStyle(n.type);
        return (
            <div className="ag-detail" role="dialog" aria-label={n.name}>
                <button type="button" className="ag-detail-close" aria-label="Close" onClick={onClose}>×</button>
                <span className="ag-detail-type" style={{ background: style.fill, borderColor: style.border, color: style.text }}>{typeName(n.type)}</span>
                <div className="ag-detail-title">{n.name}</div>
                {n.description && n.description !== n.name && <div className="ag-detail-text">{n.description}</div>}
                <div className="ag-detail-meta">
                    {[n.glkbId, n.nCitation ? `${n.nCitation.toLocaleString()} articles` : '', n.bridge ? 'Added from GLKB' : '']
                        .filter(Boolean).join(' · ')}
                </div>
            </div>
        );
    }
    const e = item.edge;
    const a = nodesByKey.get(e.source)?.name || e.source;
    const b = nodesByKey.get(e.target)?.name || e.target;
    const show = () => setNotFound(!onShowSentence(e.sentence));
    return (
        <div className="ag-detail ag-v2-detail" role="dialog" aria-label={`${a} ${e.label} ${b}`}>
            <button type="button" className="ag-detail-close" aria-label="Close" onClick={onClose}>×</button>
            <div className="ag-detail-kicker">{e.layer === 'bridge' ? 'GLKB indirect link' : 'From the answer'}</div>
            <div className="ag-detail-title">{a} <span style={{ color: POLARITY[e.polarity].color }}>{e.label}</span> {b}</div>
            {CERTAINTY_TEXT[e.certainty] && <div className="ag-detail-meta">{CERTAINTY_TEXT[e.certainty]}</div>}
            {e.sentence && <blockquote className="ag-v2-sentence">{e.sentence}</blockquote>}
            <Papers pmids={e.pmids} references={references} />
            {e.glkb.length > 0 && (
                <>
                    <div className="ag-detail-kicker ag-v2-section">In GLKB</div>
                    <ul className="ag-detail-list">
                        {e.glkb.map((rel, i) => <li key={`${rel.type}-${rel.subtype}-${i}`}>{glkbSupportText(rel)}</li>)}
                    </ul>
                </>
            )}
            {e.sentence && (
                <button type="button" className="ag-v2-show" onClick={show}>Show in answer</button>
            )}
            {notFound && <div className="ag-detail-meta">That sentence could not be found in the answer as shown.</div>}
        </div>
    );
}

/**
 * The answer graph (v2) of one answer: `graph` is `normalizeAnswerGraph`'s shape. `references`
 * (the answer's list) numbers and names its cited papers as the answer does. `onShowSentence`
 * replaces the default "Show in answer" (scroll to the sentence in the surrounding answer and
 * mark it); it returns whether the sentence was found.
 */
export default function AnswerGraphV2({ graph, caption, references, onShowSentence }) {
    const wrapRef = useRef(null);
    const cyHostRef = useRef(null);
    const legendRef = useRef(null);
    const cyRef = useRef(null);
    const [width, setWidth] = useState(0);
    const [legendOpen, setLegendOpen] = useState(true);
    const [selected, setSelected] = useState(null);
    const [focus, setFocus] = useState(() => new Set());
    // GLKB's multi-hop supplement is off until the reader asks for it.
    const [showBridge, setShowBridge] = useState(false);
    const [fontReady, setFontReady] = useState(false);

    const drawn = useMemo(() => visibleGraph(graph, showBridge), [graph, showBridge]);
    const nodesByKey = useMemo(() => new Map((graph?.nodes || []).map((n) => [n.key, n])), [graph]);
    const types = useMemo(() => presentTypes(drawn.nodes), [drawn]);
    const layout = cardLayout(width);

    useEffect(() => {
        let live = true;
        loadGraphFont().then(() => { if (live) setFontReady(true); });
        return () => { live = false; };
    }, []);

    useLayoutEffect(() => {
        const el = wrapRef.current;
        if (!el) return undefined;
        setWidth(el.clientWidth);
        if (typeof ResizeObserver === 'undefined') return undefined;
        const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const fit = useCallback(() => {
        const cy = cyRef.current;
        const host = cyHostRef.current;
        if (!cy || !host) return;
        cy.resize();
        const all = cy.elements();
        if (!all.length) return;
        const pad = layout.size === 'sm' ? 12 : 24;
        const legendH = legendOpen && layout.legend !== 'below' ? (legendRef.current?.offsetHeight || 0) + 12 : 0;
        const w = host.clientWidth - pad * 2;
        const h = host.clientHeight - legendH - pad * 2;
        if (w <= 0 || h <= 0) return;
        const bb = all.boundingBox();
        const zoom = Math.max(0.35, Math.min(1, w / bb.w, h / bb.h));
        cy.zoom(zoom);
        cy.pan({ x: pad + w / 2 - (bb.x1 + bb.w / 2) * zoom, y: pad + h / 2 - (bb.y1 + bb.h / 2) * zoom });
    }, [layout.size, layout.legend, legendOpen]);

    useEffect(() => {
        if (!cyHostRef.current || !drawn.nodes.length || !fontReady) return undefined;
        const cy = Cytoscape({
            container: cyHostRef.current, elements: buildElements(drawn), style: STYLE,
            userZoomingEnabled: false, boxSelectionEnabled: false, autoungrabify: false,
            minZoom: 0.35, maxZoom: 1.6,
        });
        cyRef.current = cy;
        withSeededRandom(hash(drawn.nodes.map((n) => n.key).join('|')), () => cy.layout(layoutOptions(drawn)).run());
        const host = cyHostRef.current;
        cy.on('mouseover', 'node, edge', (evt) => { evt.target.addClass('hover'); host.style.cursor = 'pointer'; });
        cy.on('mouseout', 'node, edge', (evt) => { evt.target.removeClass('hover'); host.style.cursor = ''; });
        cy.on('tap', 'node', (evt) => setSelected({ kind: 'node', id: evt.target.id() }));
        cy.on('tap', 'edge', (evt) => setSelected({ kind: 'edge', id: evt.target.id() }));
        cy.on('tap', (evt) => { if (evt.target === cy) setSelected(null); });
        return () => { cy.destroy(); cyRef.current = null; };
    }, [drawn, fontReady]);

    useEffect(() => { fit(); }, [fit, width, drawn, fontReady]);

    useEffect(() => {
        const cy = cyRef.current;
        if (!cy) return;
        cy.batch(() => {
            cy.elements().removeClass('faded active');
            let keep = null;
            if (selected) {
                const el = cy.getElementById(selected.id);
                if (el.nonempty()) {
                    el.addClass('active');
                    keep = el.isNode() ? el.closedNeighborhood() : el.union(el.connectedNodes());
                }
            } else if (focus.size) {
                keep = cy.nodes().filter((n) => focus.has(n.data('type')));
                keep = keep.union(keep.edgesWith(keep));
            }
            if (keep) cy.elements().difference(keep).addClass('faded');
        });
    }, [selected, focus, drawn, fontReady]);

    const toggleFocus = useCallback((type) => {
        setSelected(null);
        setFocus((prev) => { const next = new Set(prev); if (next.has(type)) next.delete(type); else next.add(type); return next; });
    }, []);
    const toggleBridge = useCallback(() => { setSelected(null); setShowBridge((v) => !v); }, []);
    const show = useCallback((sentence) => {
        if (onShowSentence) return onShowSentence(sentence);
        const root = wrapRef.current?.closest('.markdown-body') || wrapRef.current?.parentElement;
        return showSentence(root, sentence);
    }, [onShowSentence]);

    if (!drawn.nodes.length) return null;
    const item = selected?.kind === 'node'
        ? (nodesByKey.get(selected.id) && { kind: 'node', node: nodesByKey.get(selected.id) })
        : selected?.kind === 'edge'
            ? (drawn.edges.find((e) => e.id === selected.id) && { kind: 'edge', edge: drawn.edges.find((e) => e.id === selected.id) })
            : null;
    const legendProps = { graph, types, focus, onFocus: toggleFocus, showBridge, onBridge: toggleBridge };

    return (
        <figure className={`ag-card ag-v2 ag-${layout.size}`} ref={wrapRef} aria-label="Knowledge graph of what this answer says">
            <div className="ag-canvas" style={{ height: layout.height || 336 }}>
                <div className="ag-cy" ref={cyHostRef} data-testid="answer-graph-v2-canvas" />
                <Detail
                    key={selected ? `${selected.kind}:${selected.id}` : 'none'}
                    item={item} nodesByKey={nodesByKey} references={references}
                    onShowSentence={show} onClose={() => setSelected(null)}
                />
                <div className="ag-bottom">
                    <button
                        type="button" className={`ag-info${legendOpen ? ' is-on' : ''}`}
                        aria-label={legendOpen ? 'Hide legend' : 'Show legend'} aria-expanded={legendOpen}
                        onClick={() => setLegendOpen((v) => !v)}
                    >
                        <InfoIcon />
                    </button>
                    {legendOpen && layout.legend !== 'below' && (
                        <div ref={legendRef} className="ag-legend-wrap"><Legend variant={layout.legend} {...legendProps} /></div>
                    )}
                </div>
            </div>
            {legendOpen && layout.legend === 'below' && <Legend variant="below" {...legendProps} />}
            {caption && <figcaption className="ag-caption">{caption}</figcaption>}
        </figure>
    );
}
