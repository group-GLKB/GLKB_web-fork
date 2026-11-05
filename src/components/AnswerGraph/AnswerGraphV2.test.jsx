/**
 * The answer graph (v2) as drawn — AnswerGraphV2.jsx, from the fixture payload.
 *
 * jsdom has no canvas, so Cytoscape is replaced by a recorder: what is pinned is what the card
 * hands it (elements, styles by polarity and certainty, the chain's placement constraints) and
 * what the card itself renders around it (legend, the bridge toggle, the detail panel an edge or
 * node opens, "Show in answer").
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

/* eslint-disable import/first */
const mockInstances = [];
jest.mock('cytoscape', () => {
    const collection = () => {
        const c = {
            length: 1,
            removeClass: () => c, addClass: () => c, toggleClass: () => c,
            union: () => c, difference: () => c, filter: () => c, edgesWith: () => c,
            closedNeighborhood: () => c, connectedNodes: () => c,
            nonempty: () => true, isNode: () => false, forEach: () => {},
            boundingBox: () => ({ x1: 0, y1: 0, w: 400, h: 200 }),
        };
        return c;
    };
    const factory = (opts) => {
        const cy = {
            opts,
            handlers: [],
            layoutOptions: null,
            layout: (options) => { cy.layoutOptions = options; return { run: () => {} }; },
            on: (evt, sel, fn) => cy.handlers.push({ evt, sel: typeof sel === 'string' ? sel : null, fn: fn || sel }),
            destroy: () => { cy.destroyed = true; },
            resize: () => {}, zoom: () => {}, pan: () => {}, batch: (fn) => fn(),
            elements: collection, nodes: collection, edges: collection, getElementById: collection,
        };
        mockInstances.push(cy);
        return cy;
    };
    factory.use = () => {};
    return { __esModule: true, default: factory };
});
jest.mock('cytoscape-fcose', () => () => {});

import AnswerGraphV2, { buildElements, layoutOptions } from './AnswerGraphV2';
import { normalizeAnswerGraph, POLARITY, visibleGraph } from './answerGraphV2Data';
import fixture from './answerGraphV2Fixture.json';
/* eslint-enable import/first */

const graph = normalizeAnswerGraph(fixture.answer_graph);
const REFERENCES = [
    { title: 'Metformin and AMPK', url: 'https://pubmed.ncbi.nlm.nih.gov/12345678/' },
    { title: 'mTORC1 and growth', url: 'https://pubmed.ncbi.nlm.nih.gov/23456789/' },
];

const live = () => mockInstances.filter((cy) => !cy.destroyed);
const cy = () => live()[live().length - 1];
const tap = (selector, id) => act(() => {
    cy().handlers.find((h) => h.evt === 'tap' && h.sel === selector).fn({ target: { id: () => id } });
});

beforeEach(() => { mockInstances.length = 0; });

describe('what Cytoscape is handed', () => {
    it('the answer\'s layer only, styled by polarity and certainty, with the GLKB mark', () => {
        const elements = buildElements(visibleGraph(graph, false));
        const nodes = elements.filter((e) => e.group === 'nodes').map((e) => e.data);
        const edges = elements.filter((e) => e.group === 'edges').map((e) => e.data);
        expect(nodes.map((n) => n.id)).toEqual(['n1', 'n2', 'n3', 'n4', 'n5']);
        expect(nodes.find((n) => n.id === 'n1')).toMatchObject({ focus: true, bridge: false, type: 'ChemicalEntity' });
        expect(edges.map((e) => [e.id, e.label, e.color, e.certainty])).toEqual([
            ['e1', 'activates · GLKB', POLARITY.positive.color, 'established'],
            ['e2', 'inhibits', POLARITY.negative.color, 'established'],
            ['e3', 'drives', POLARITY.positive.color, 'suggested'],
            ['e4', 'may prevent', POLARITY.negative.color, 'conflicting'],
        ]);
    });

    it('the chain left to right, as fcose constraints', () => {
        const options = layoutOptions(visibleGraph(graph, false));
        expect(options.name).toBe('fcose');
        expect(options.relativePlacementConstraint).toEqual([
            { left: 'n1', right: 'n2', gap: 140 },
            { left: 'n2', right: 'n3', gap: 140 },
            { left: 'n3', right: 'n4', gap: 140 },
        ]);
        expect(options.alignmentConstraint).toEqual({ horizontal: [['n1', 'n2', 'n3', 'n4']] });
    });
});

describe('the card', () => {
    it('draws the payload, with the chain constraints and the bridge layer off', async () => {
        render(<AnswerGraphV2 graph={graph} caption="What this answer says" references={REFERENCES} />);
        await waitFor(() => expect(cy()).toBeTruthy());
        expect(cy().opts.elements.map((e) => e.data.id)).not.toContain('n6');
        expect(cy().layoutOptions.relativePlacementConstraint).toHaveLength(3);
        expect(screen.getByText('What this answer says')).toBeInTheDocument();
        // The legend says what the lines mean.
        ['Increases / activates', 'Decreases / inhibits', 'Suggested', 'Conflicting evidence', 'Also a GLKB relation']
            .forEach((text) => expect(screen.getByText(text)).toBeInTheDocument());
        expect(screen.getByRole('button', { name: 'GLKB indirect links' })).toHaveAttribute('aria-pressed', 'false');
        // Wheel zoom is off in a scrolling chat, so the buttons are how a reader zooms.
        ['Zoom in', 'Zoom out', 'Fit to view'].forEach((name) =>
            expect(screen.getByRole('button', { name })).toBeInTheDocument());
    });

    it('shows GLKB\'s indirect links when asked', async () => {
        render(<AnswerGraphV2 graph={graph} />);
        await waitFor(() => expect(cy()).toBeTruthy());
        fireEvent.click(screen.getByRole('button', { name: 'GLKB indirect links' }));
        await waitFor(() => expect(cy().opts.elements.map((e) => e.data.id)).toContain('n6'));
        expect(cy().opts.elements.find((e) => e.data.id === 'e5').data.layer).toBe('bridge');
        expect(screen.getByRole('button', { name: 'GLKB indirect links' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('opens an edge: its sentence, its papers, GLKB\'s support, and "Show in answer"', async () => {
        const onShowSentence = jest.fn(() => true);
        render(<AnswerGraphV2 graph={graph} references={REFERENCES} onShowSentence={onShowSentence} />);
        await waitFor(() => expect(cy()).toBeTruthy());
        tap('edge', 'e1');
        const panel = screen.getByRole('dialog', { name: 'Metformin activates AMPK' });
        expect(within(panel).getByText('From the answer')).toBeInTheDocument();
        expect(within(panel).getByText('Metformin activates AMPK in hepatocytes [12345678].')).toBeInTheDocument();
        const paper = within(panel).getByRole('link', { name: '[1] Metformin and AMPK' });
        expect(paper).toHaveAttribute('href', 'https://pubmed.ncbi.nlm.nih.gov/12345678/');
        expect(paper).toHaveAttribute('target', '_blank');
        expect(within(panel).getByText('activation · PrimeKG · 1,234 articles')).toBeInTheDocument();
        fireEvent.click(within(panel).getByRole('button', { name: 'Show in answer' }));
        expect(onShowSentence).toHaveBeenCalledWith('Metformin activates AMPK in hepatocytes [12345678].');
    });

    it('says how sure the answer is, names a paper not in the list by its PMID, and admits a sentence it cannot find', async () => {
        render(<AnswerGraphV2 graph={graph} references={REFERENCES} onShowSentence={() => false} />);
        await waitFor(() => expect(cy()).toBeTruthy());
        tap('edge', 'e4');
        const panel = screen.getByRole('dialog', { name: 'Metformin may prevent Cancer' });
        expect(within(panel).getByText('The evidence on this is conflicting.')).toBeInTheDocument();
        expect(within(panel).getByRole('link', { name: 'PMID 45678901' }))
            .toHaveAttribute('href', 'https://pubmed.ncbi.nlm.nih.gov/45678901/');
        fireEvent.click(within(panel).getByRole('button', { name: 'Show in answer' }));
        expect(within(panel).getByText(/could not be found in the answer/)).toBeInTheDocument();
        tap('edge', 'e3');
        expect(screen.getByText('The answer suggests this rather than states it.')).toBeInTheDocument();
        expect(screen.queryByText(/could not be found/)).toBeNull();
    });

    it('opens a node as the basic graph does: name, type, description, articles', async () => {
        render(<AnswerGraphV2 graph={graph} />);
        await waitFor(() => expect(cy()).toBeTruthy());
        tap('node', 'n1');
        const panel = screen.getByRole('dialog', { name: 'Metformin' });
        expect(within(panel).getByText('Chemicals / Drugs')).toBeInTheDocument();
        expect(within(panel).getByText('A biguanide antidiabetic agent.')).toBeInTheDocument();
        expect(within(panel).getByText('mesh:D008687 · 1,234 articles')).toBeInTheDocument();
        fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
