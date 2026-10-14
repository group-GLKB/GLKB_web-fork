import './AnswerGraph.css';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';

import { nodeStyle } from '../Graph/nodeStyle';
import { GRAPH_FONT, loadGraphFont } from '../Graph/labels';
import { cardLayout, curatedLabel, presentTypes, typeName } from './answerGraph';

Cytoscape.use(fcose);

/* Figma "KG - Node": Geist 14/22, 8px padding, labels wrap at 160px. */
const FONT_SIZE = 14;
const LINE_HEIGHT = 22;
const PAD = 8;
const MAX_TEXT = 160;
const EDGE = '#CBD2E0';
const EDGE_ACTIVE = '#5E6E87';

let measureCtx;
const textWidth = (text, weight = 400) => {
    if (measureCtx === undefined) {
        try { measureCtx = document.createElement('canvas').getContext('2d'); } catch { measureCtx = null; }
    }
    if (!measureCtx) return text.length * 7.6; // jsdom: no canvas
    measureCtx.font = `${weight} ${FONT_SIZE}px ${GRAPH_FONT}`;
    return measureCtx.measureText(text).width;
};

/** Greedy word wrap at MAX_TEXT, measured at the bold weight so hover never overflows. */
export const wrapLabel = (label) => {
    const lines = [];
    let line = '';
    for (const word of String(label).split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (line && textWidth(next, 600) > MAX_TEXT) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    const width = Math.min(MAX_TEXT, Math.max(...lines.map((l) => textWidth(l, 600)), 0));
    return { text: lines.join('\n'), width: Math.ceil(width) + PAD * 2, height: lines.length * LINE_HEIGHT + PAD * 2 };
};

/* fcose places nodes from Math.random. Seeding it makes one answer's graph come out the
   same every time it is drawn, instead of rearranging itself on each visit. */
const withSeededRandom = (seed, fn) => {
    const original = Math.random;
    let s = seed >>> 0 || 1;
    Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    try { return fn(); } finally { Math.random = original; }
};
const hash = (text) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

const STYLE = [
    { selector: 'node', style: {
        shape: 'round-rectangle', width: 'data(w)', height: 'data(h)',
        'background-color': 'data(fill)', 'border-color': 'data(border)', 'border-width': 0.8,
        label: 'data(label)', color: 'data(text)', 'font-family': GRAPH_FONT, 'font-size': FONT_SIZE,
        'font-weight': 400, 'line-height': LINE_HEIGHT / FONT_SIZE, 'text-wrap': 'wrap',
        'text-max-width': 1000, 'text-valign': 'center', 'text-halign': 'center',
        'overlay-opacity': 0, 'transition-property': 'opacity', 'transition-duration': 120,
    } },
    { selector: 'node.hover, node.active', style: { 'font-weight': 600, 'border-width': 1.6 } },
    { selector: 'edge', style: {
        width: 2, 'line-color': EDGE, 'curve-style': 'bezier', 'control-point-step-size': 48,
        'line-cap': 'round', 'overlay-opacity': 0, 'overlay-padding': 6,
        'transition-property': 'opacity, line-color', 'transition-duration': 120,
    } },
    { selector: 'edge[kind = "curated"]', style: { 'line-style': 'dashed', 'line-dash-pattern': [8, 8] } },
    { selector: 'edge.hover, edge.active', style: { 'line-color': EDGE_ACTIVE } },
    { selector: '.faded', style: { opacity: 0.22 } },
    { selector: '.hidden', style: { display: 'none' } },
];

const InfoIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 9v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10" cy="6.75" r="0.9" fill="currentColor" />
    </svg>
);
const Check = ({ color }) => (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M10 3 4.5 8.5 2 6" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

function Legend({ variant, types, focus, onFocus, hiddenKinds, onKind }) {
    const entity = (type) => {
        const style = nodeStyle(type);
        const on = focus.has(type);
        return (
            <button
                key={type} type="button" className={`ag-entity${on ? ' is-on' : ''}`}
                style={variant === 'below' ? { background: style.fill, borderColor: style.border, color: style.text } : { color: style.text }}
                aria-pressed={on} onClick={() => onFocus(type)}
            >
                {variant !== 'below' && (
                    <span className="ag-swatch" style={{ background: type === 'Article' ? 'var(--color-background-subtle, #FAFCFF)' : style.fill, borderColor: style.border }}>
                        {on && <Check color={style.text} />}
                    </span>
                )}
                {typeName(type)}
            </button>
        );
    };
    const kind = (key, label) => (
        <button
            key={key} type="button" className={`ag-kind ag-kind-${key}${hiddenKinds.has(key) ? ' is-off' : ''}`}
            aria-pressed={!hiddenKinds.has(key)} onClick={() => onKind(key)}
        >
            <span className="ag-rule" /><span className="ag-kind-label">{label}</span><span className="ag-rule" />
        </button>
    );
    return (
        <div className={`ag-legend ag-legend-${variant}`}>
            <div className="ag-legend-entities">
                <div className="ag-legend-title">Entities</div>
                <div className="ag-entity-grid">{types.map(entity)}</div>
            </div>
            <div className="ag-legend-divider" />
            <div className="ag-legend-rels">
                <div className="ag-legend-title">Relationships</div>
                {kind('semantic', 'Semantic')}
                {kind('curated', 'Curated')}
            </div>
        </div>
    );
}

function Detail({ item, nodesById, onClose }) {
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
                <div className="ag-detail-meta">{n.id}{n.nCitation ? ` · ${n.nCitation.toLocaleString()} articles` : ''}</div>
            </div>
        );
    }
    const e = item.edge;
    const a = nodesById.get(e.source)?.name || e.source;
    const b = nodesById.get(e.target)?.name || e.target;
    return (
        <div className="ag-detail" role="dialog" aria-label={`${a} and ${b}`}>
            <button type="button" className="ag-detail-close" aria-label="Close" onClick={onClose}>×</button>
            <div className="ag-detail-kicker">{e.kind === 'semantic' ? 'Semantic relationship' : 'Curated relationship'}</div>
            <div className="ag-detail-title">{a} &amp; {b}</div>
            {e.kind === 'semantic' ? (
                <div className="ag-detail-text">
                    {e.semantic.cooccur && e.semantic.nArticle > 0 && <>Co-occur in {e.semantic.nArticle.toLocaleString()} articles</>}
                    {e.semantic.cooccur && e.semantic.nArticle > 0 && e.semantic.similar && <br />}
                    {e.semantic.similar && <>Semantically similar terms</>}
                    {!e.semantic.cooccur && !e.semantic.similar && <>Related in the literature</>}
                </div>
            ) : (
                <ul className="ag-detail-list">
                    {e.curated.map((rel) => (
                        <li key={`${rel.type}-${rel.subtype}`}>{curatedLabel(rel)}{rel.source ? <span className="ag-detail-source"> · {rel.source === 'primekg' ? 'PrimeKG' : rel.source}</span> : null}</li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/**
 * The answer's knowledge graph, drawn in the answer itself (Figma "KG 4-3").
 * `graph` is `{nodes, edges}` from graphFromRows; nothing is drawn without nodes.
 */
export default function AnswerGraph({ graph, caption }) {
    const wrapRef = useRef(null);
    const cyHostRef = useRef(null);
    const legendRef = useRef(null);
    const cyRef = useRef(null);
    const [width, setWidth] = useState(0);
    const [legendOpen, setLegendOpen] = useState(true);
    const [selected, setSelected] = useState(null);
    const [focus, setFocus] = useState(() => new Set());
    const [hiddenKinds, setHiddenKinds] = useState(() => new Set());
    const [fontReady, setFontReady] = useState(false);

    const nodes = useMemo(() => graph?.nodes || [], [graph]);
    const edges = useMemo(() => graph?.edges || [], [graph]);
    const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
    const types = useMemo(() => presentTypes(nodes), [nodes]);
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

    /* Fit what is visible into the part of the canvas the legend does not cover, never past
       100% — the labels are set at their real 14px and should not grow. */
    const fit = useCallback(() => {
        const cy = cyRef.current;
        const host = cyHostRef.current;
        if (!cy || !host) return;
        cy.resize();
        const visible = cy.elements(':visible');
        if (!visible.length) return;
        const pad = layout.size === 'sm' ? 12 : 24;
        const legendH = legendOpen && layout.legend !== 'below' ? (legendRef.current?.offsetHeight || 0) + 12 : 0;
        const w = host.clientWidth - pad * 2;
        const h = host.clientHeight - legendH - pad * 2;
        if (w <= 0 || h <= 0) return;
        const bb = visible.boundingBox();
        const zoom = Math.max(0.35, Math.min(1, w / bb.w, h / bb.h));
        cy.zoom(zoom);
        cy.pan({ x: pad + w / 2 - (bb.x1 + bb.w / 2) * zoom, y: pad + h / 2 - (bb.y1 + bb.h / 2) * zoom });
    }, [layout.size, layout.legend, legendOpen]);

    // Build the graph once per data (and once the font can be measured).
    useEffect(() => {
        if (!cyHostRef.current || !nodes.length || !fontReady) return undefined;
        const elements = [
            ...nodes.map((n) => {
                const style = nodeStyle(n.type);
                const label = wrapLabel(n.name);
                return { group: 'nodes', data: { id: n.id, type: n.type, label: label.text, w: label.width, h: label.height, fill: style.fill, border: style.border, text: style.text } };
            }),
            ...edges.map((e) => ({ group: 'edges', data: { id: e.id, source: e.source, target: e.target, kind: e.kind } })),
        ];
        const cy = Cytoscape({
            container: cyHostRef.current, elements, style: STYLE,
            userZoomingEnabled: false, boxSelectionEnabled: false, autoungrabify: false,
            minZoom: 0.35, maxZoom: 1.6,
        });
        cyRef.current = cy;
        withSeededRandom(hash(nodes.map((n) => n.id).join('|')), () => cy.layout({
            name: 'fcose', quality: 'proof', randomize: true, animate: false, fit: false,
            nodeDimensionsIncludeLabels: false, idealEdgeLength: () => 120, nodeRepulsion: () => 9000,
            nodeSeparation: 80, edgeElasticity: () => 0.3, gravity: 0.35, numIter: 2500,
        }).run());

        const host = cyHostRef.current;
        cy.on('mouseover', 'node, edge', (evt) => { evt.target.addClass('hover'); host.style.cursor = 'pointer'; });
        cy.on('mouseout', 'node, edge', (evt) => { evt.target.removeClass('hover'); host.style.cursor = ''; });
        cy.on('tap', 'node', (evt) => setSelected({ kind: 'node', id: evt.target.id() }));
        cy.on('tap', 'edge', (evt) => setSelected({ kind: 'edge', id: evt.target.id() }));
        cy.on('tap', (evt) => { if (evt.target === cy) setSelected(null); });
        return () => { cy.destroy(); cyRef.current = null; };
    }, [nodes, edges, fontReady]);

    useEffect(() => { fit(); }, [fit, width, nodes, edges, fontReady, hiddenKinds]);

    // Fading: a selection keeps its neighbourhood; a legend focus keeps its types.
    useEffect(() => {
        const cy = cyRef.current;
        if (!cy) return;
        cy.batch(() => {
            cy.elements().removeClass('faded active');
            cy.edges().forEach((e) => { e.toggleClass('hidden', hiddenKinds.has(e.data('kind'))); });
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
    }, [selected, focus, hiddenKinds, nodes, edges, fontReady]);

    const toggleFocus = useCallback((type) => {
        setSelected(null);
        setFocus((prev) => { const next = new Set(prev); next.has(type) ? next.delete(type) : next.add(type); return next; });
    }, []);
    const toggleKind = useCallback((key) => {
        setHiddenKinds((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
    }, []);

    if (!nodes.length) return null;
    const item = selected?.kind === 'node'
        ? (nodesById.get(selected.id) && { kind: 'node', node: nodesById.get(selected.id) })
        : selected?.kind === 'edge' ? (edges.find((e) => e.id === selected.id) && { kind: 'edge', edge: edges.find((e) => e.id === selected.id) }) : null;
    const legendProps = { types, focus, onFocus: toggleFocus, hiddenKinds, onKind: toggleKind };

    return (
        <figure className={`ag-card ag-${layout.size}`} ref={wrapRef} aria-label="Knowledge graph of this answer">
            <div className="ag-canvas" style={{ height: layout.height || 336 }}>
                <div className="ag-cy" ref={cyHostRef} data-testid="answer-graph-canvas" />
                <Detail item={item} nodesById={nodesById} onClose={() => setSelected(null)} />
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
