/**
 * Zoom in, zoom out and fit, for the graphs drawn inside an answer (the basic graph and the answer
 * graph). Both keep Cytoscape's wheel zoom OFF on purpose: the graph sits in a scrolling chat, and a
 * wheel over it would zoom the graph instead of scrolling the page. These buttons are the only way
 * to zoom, so a reader can get close to a dense part of the graph and back.
 *
 * Zooming is about the canvas centre, in steps of ZOOM_STEP, clamped to the graph's own
 * minZoom / maxZoom. "Fit" is the graph's own fit (what it shows when it opens).
 */
import React from 'react';

export const ZOOM_STEP = 1.25;
/** The zoom ceiling for both graphs: fit never goes past 100%, the buttons may go this far. */
export const MAX_ZOOM = 2.5;
/** Width the controls take on the canvas's left edge; a graph's fit keeps its nodes clear of it. */
export const ZOOM_GUTTER = 32;

/** Zoom ``cy`` by ``factor`` about the canvas centre, within its zoom limits. Returns the new level,
 * or null when there is nothing to zoom (no graph yet). */
export const zoomBy = (cy, factor) => {
    if (!cy || typeof cy.zoom !== 'function') return null;
    const current = cy.zoom();
    if (typeof current !== 'number' || !Number.isFinite(current)) return null;
    const min = typeof cy.minZoom === 'function' ? cy.minZoom() : 0.1;
    const max = typeof cy.maxZoom === 'function' ? cy.maxZoom() : MAX_ZOOM;
    const level = Math.min(max, Math.max(min, current * factor));
    const width = typeof cy.width === 'function' ? cy.width() : 0;
    const height = typeof cy.height === 'function' ? cy.height() : 0;
    cy.zoom({ level, renderedPosition: { x: width / 2, y: height / 2 } });
    return level;
};

const Icon = ({ children }) => (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {children}
    </svg>
);

/** ``cyRef`` holds the graph's Cytoscape instance; ``onFit`` re-fits the graph as it opened. */
export default function ZoomControls({ cyRef, onFit }) {
    return (
        <div className="ag-zoom" role="group" aria-label="Zoom">
            <button type="button" aria-label="Zoom in" title="Zoom in"
                onClick={() => zoomBy(cyRef.current, ZOOM_STEP)}>
                <Icon><path d="M8 3.5v9M3.5 8h9" /></Icon>
            </button>
            <button type="button" aria-label="Zoom out" title="Zoom out"
                onClick={() => zoomBy(cyRef.current, 1 / ZOOM_STEP)}>
                <Icon><path d="M3.5 8h9" /></Icon>
            </button>
            <button type="button" aria-label="Fit to view" title="Fit to view" onClick={() => onFit?.()}>
                <Icon>
                    <path d="M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3" />
                </Icon>
            </button>
        </div>
    );
}
