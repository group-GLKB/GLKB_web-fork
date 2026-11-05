/**
 * The graph's zoom buttons: in and out about the canvas centre within the graph's limits, fit as
 * the graph opened, and nothing at all before a graph exists.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import ZoomControls, { MAX_ZOOM, ZOOM_STEP, zoomBy } from './ZoomControls';

const fakeCy = (level = 1, { min = 0.35, max = MAX_ZOOM } = {}) => {
    const cy = {
        level,
        calls: [],
        zoom: (arg) => {
            if (arg === undefined) return cy.level;
            cy.calls.push(arg);
            cy.level = arg.level;
            return cy;
        },
        minZoom: () => min,
        maxZoom: () => max,
        width: () => 600,
        height: () => 300,
    };
    return cy;
};

describe('zoomBy', () => {
    it('zooms about the canvas centre by the factor', () => {
        const cy = fakeCy(1);
        expect(zoomBy(cy, ZOOM_STEP)).toBeCloseTo(1.25);
        expect(cy.calls[0]).toEqual({ level: 1.25, renderedPosition: { x: 300, y: 150 } });
    });

    it('stays within the graph limits', () => {
        expect(zoomBy(fakeCy(2.4), ZOOM_STEP)).toBe(MAX_ZOOM);
        expect(zoomBy(fakeCy(0.4), 1 / ZOOM_STEP)).toBe(0.35);
    });

    it('does nothing without a graph, or with one that cannot report its zoom', () => {
        expect(zoomBy(null, ZOOM_STEP)).toBeNull();
        expect(zoomBy({ zoom: () => undefined }, ZOOM_STEP)).toBeNull();
    });
});

describe('ZoomControls', () => {
    it('zooms in, out, and fits', () => {
        const cy = fakeCy(1);
        const onFit = jest.fn();
        render(<ZoomControls cyRef={{ current: cy }} onFit={onFit} />);
        fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
        expect(cy.level).toBeCloseTo(1.25);
        fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
        fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
        expect(cy.level).toBeCloseTo(0.8);
        fireEvent.click(screen.getByRole('button', { name: 'Fit to view' }));
        expect(onFit).toHaveBeenCalledTimes(1);
    });

    it('is safe to press before the graph is built', () => {
        render(<ZoomControls cyRef={{ current: null }} />);
        fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
        fireEvent.click(screen.getByRole('button', { name: 'Fit to view' }));
    });
});
