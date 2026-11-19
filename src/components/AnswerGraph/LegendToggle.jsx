/**
 * Show / hide the legend of a graph drawn in an answer (the basic graph and the answer graph).
 * A labelled pill rather than a bare (i) icon: the text says what it does and the chevron
 * which way, so a reader can tell the legend can be put away and brought back.
 */
import React from 'react';

const Chevron = ({ open }) => (
    <svg className={`ag-legend-toggle-chevron${open ? ' is-open' : ''}`} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const LegendIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <rect x="1.5" y="2" width="3" height="3" rx="0.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <rect x="1.5" y="9" width="3" height="3" rx="0.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M7 3.5h5.5M7 10.5h5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
);

export default function LegendToggle({ open, onToggle, controls }) {
    return (
        <button
            type="button"
            className={`ag-legend-toggle${open ? ' is-open' : ''}`}
            aria-expanded={open}
            aria-controls={controls}
            onClick={onToggle}
        >
            <LegendIcon />
            <span>{open ? 'Hide legend' : 'Show legend'}</span>
            <Chevron open={open} />
        </button>
    );
}
