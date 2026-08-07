/**
 * Reference hover card — Figma "Reference - Hover Preview" (299:22085).
 *
 * Geometry is covered by e2e/scripts/measure-reference-hover-card.mjs, which needs a browser.
 * What is worth pinning here is what the card says and how it behaves: it replaces the browser's
 * native `title` tooltip, so it has to carry everything that tooltip could not — which paper the
 * quote came from — and it has to survive the pointer travelling onto it.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ReferenceHoverCard, { formatAuthors, formatCitations, formatSource } from './ReferenceHoverCard';

const REFERENCE = {
    pmid: '38409439',
    title: 'Interferons are key cytokines acting on pancreatic islets in type 1 diabetes.',
    authors: ['Coomans de Brachène A', 'Alvelos M', 'Szymczak F'],
    date: '2024-03-01',
    journal: 'Diabetologia',
    n_citation: 1,
    url: 'https://pubmed.ncbi.nlm.nih.gov/38409439/',
    evidence: ['IFN-alpha induced HLA-I hyperexpression in human islets.'],
};

const setup = (props = {}) => {
    const onMouseEnter = jest.fn();
    const onMouseLeave = jest.fn();
    const onBookmark = jest.fn();
    const onCite = jest.fn();
    const utils = render(
        <ReferenceHoverCard
            reference={REFERENCE}
            number={10}
            anchorRect={{ left: 400, top: 500, bottom: 516, width: 20, height: 16 }}
            isBookmarked={false}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onBookmark={onBookmark}
            onCite={onCite}
            onFullText={() => {}}
            {...props}
        />,
    );
    return { ...utils, onMouseEnter, onMouseLeave, onBookmark, onCite };
};

describe('what the card shows', () => {
    it('names the paper the quote came from — the thing a native tooltip could not', () => {
        setup();
        expect(screen.getByText(REFERENCE.title)).toBeInTheDocument();
        expect(screen.getByText('Coomans de Brachène A et al.')).toBeInTheDocument();
        expect(screen.getByText('2024 · Diabetologia')).toBeInTheDocument();
    });

    it('shows the evidence quote in quotation marks, without doubling existing ones', () => {
        setup();
        expect(screen.getByText('“IFN-alpha induced HLA-I hyperexpression in human islets.”')).toBeInTheDocument();

        setup({ reference: { ...REFERENCE, evidence: ['“already quoted”'] } });
        expect(screen.getByText('“already quoted”')).toBeInTheDocument();
    });

    it('shows the PMID and citation count, and the citation number as a badge', () => {
        setup();
        expect(screen.getByText('PMID: 38409439 · 1 Citation')).toBeInTheDocument();
        expect(document.querySelector('.ref-hover-badge').textContent).toBe('10');
    });

    it('links Full Text to the actual full text, not the PubMed record', () => {
        // The body no longer carries inline "(full text)" links, so this is the only route to the
        // paper — pointing it at PubMed would make the label a lie.
        setup({ reference: { ...REFERENCE, fulltext_url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC123/' } });
        expect(screen.getByRole('link', { name: /full text/i }))
            .toHaveAttribute('href', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC123/');
    });

    it('falls back to the PubMed record when there is no full text', () => {
        setup();
        expect(screen.getByRole('link', { name: /full text/i }))
            .toHaveAttribute('href', REFERENCE.url);
    });

    it('leaves out what the reference does not have, rather than printing empties', () => {
        setup({ reference: { pmid: '1', title: 'T' } });
        expect(document.querySelector('.ref-hover-quote')).not.toBeInTheDocument();
        expect(screen.getByText('PMID: 1')).toBeInTheDocument();   // no trailing " · "
    });

    it('renders nothing without a reference', () => {
        const { container } = setup({ reference: null });
        expect(container).toBeEmptyDOMElement();
    });
});

describe('behaviour', () => {
    it('is itself a hover target, so the actions can be reached', () => {
        const { onMouseEnter, onMouseLeave } = setup();
        const card = document.querySelector('.ref-hover-card');
        fireEvent.mouseEnter(card);
        expect(onMouseEnter).toHaveBeenCalled();
        fireEvent.mouseLeave(card);
        expect(onMouseLeave).toHaveBeenCalled();
    });

    it('wires the cite and bookmark actions', () => {
        const { onCite, onBookmark } = setup();
        fireEvent.click(screen.getByRole('button', { name: /cite paper/i }));
        expect(onCite).toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: /bookmark this reference/i }));
        expect(onBookmark).toHaveBeenCalled();
    });

    it('reflects an existing bookmark', () => {
        setup({ isBookmarked: true });
        expect(screen.getByRole('button', { name: /remove bookmark/i })).toBeInTheDocument();
        expect(document.querySelector('.ref-hover-bookmark.active')).toBeInTheDocument();
    });
});

describe('formatters', () => {
    it('formatAuthors: first author, then et al.', () => {
        expect(formatAuthors(['A B', 'C D'])).toBe('A B et al.');
        expect(formatAuthors(['A B'])).toBe('A B');
        expect(formatAuthors('A B; C D')).toBe('A B et al.');
        expect(formatAuthors([])).toBe('');
        expect(formatAuthors(null)).toBe('');
    });

    it('formatSource: year · journal, dropping a missing half without a stray dot', () => {
        expect(formatSource('2024-03-01', 'Diabetologia')).toBe('2024 · Diabetologia');
        expect(formatSource('', 'Diabetologia')).toBe('Diabetologia');
        expect(formatSource('2024', '')).toBe('2024');
        expect(formatSource('', '')).toBe('');
    });

    it('formatCitations: singular at one', () => {
        expect(formatCitations(1)).toBe('1 Citation');
        expect(formatCitations(43)).toBe('43 Citations');
        expect(formatCitations(0)).toBe('0 Citations');
        expect(formatCitations(null)).toBe('');
    });
});

// The geometry script measures a snapshot of this component's output; it is only trustworthy
// while that snapshot still matches what the component renders.
describe('the geometry fixture', () => {
    it('still matches what the component renders', () => {
        const FIXTURE = path.join(__dirname, '../../../e2e/fixtures/reference-hover-card.html');
        const { container } = render(
            <ReferenceHoverCard
                number={1}
                anchorRect={{ left: 400, top: 500, bottom: 516, width: 20, height: 16 }}
                isBookmarked={false}
                reference={{
                    pmid: '38409439',
                    title: 'Interferons are key cytokines acting on pancreatic islets in type 1 diabetes.',
                    authors: ['Coomans de Brachène A', 'Alvelos M', 'Szymczak F'],
                    date: '2024-03-01',
                    journal: 'Diabetologia',
                    n_citation: 1,
                    url: 'https://pubmed.ncbi.nlm.nih.gov/38409439/',
                    evidence: ['Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna...'],
                }}
                onBookmark={() => {}}
                onCite={() => {}}
                onFullText={() => {}}
                onMouseEnter={() => {}}
                onMouseLeave={() => {}}
            />,
        );
        const fixture = fs.readFileSync(FIXTURE, 'utf8');
        if (container.innerHTML !== fixture) {
            throw new Error(
                "ReferenceHoverCard's markup changed, so e2e/scripts/measure-reference-hover-card.mjs "
                + `is measuring a stale shape. Write this test's container.innerHTML to ${FIXTURE} `
                + 'and re-run the measurement.',
            );
        }
        expect(container.innerHTML).toBe(fixture);
    });
});
