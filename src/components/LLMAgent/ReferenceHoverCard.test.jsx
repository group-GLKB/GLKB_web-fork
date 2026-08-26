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

// Exactly the shape `parseReferences` in index.jsx produces — that is what the app hands this
// component. Testing the agent's raw shape instead is how `date`/`n_citation`/`fulltext_url` came
// to be read here under names that never survive normalisation.
const REFERENCE = {
    pmid: '38409439',
    title: 'Interferons are key cytokines acting on pancreatic islets in type 1 diabetes.',
    authors: 'Coomans de Brachène A, Alvelos M, Szymczak F',
    year: '2024-03-01',
    journal: 'Diabetologia',
    citation_count: 1,
    url: 'https://pubmed.ncbi.nlm.nih.gov/38409439/',
    fulltext_url: '',
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

    it('still reads the agent\'s raw field names, for an unparsed reference', () => {
        setup({ reference: { pmid: '9', title: 'T', date: '2019-06-02', journal: 'Nature', n_citation: 7 } });
        expect(screen.getByText('2019 · Nature')).toBeInTheDocument();
        expect(screen.getByText('PMID: 9 · 7 Citations')).toBeInTheDocument();
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
        render(
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
        // The card portals to <body>, so it is not in the render's own container.
        const html = document.querySelector('.ref-hover-card').outerHTML;
        if (process.env.UPDATE_FIXTURES) {
            fs.writeFileSync(FIXTURE, html);
        }
        const fixture = fs.readFileSync(FIXTURE, 'utf8');
        if (html !== fixture) {
            throw new Error(
                "ReferenceHoverCard's markup changed, so e2e/scripts/measure-reference-hover-card.mjs "
                + `is measuring a stale shape. Refresh ${FIXTURE} by re-running this test with `
                + 'UPDATE_FIXTURES=1, then re-run the measurement.',
            );
        }
        expect(html).toBe(fixture);
    });
});

/**
 * The card lives over the answer while the references panel scrolls itself to the entry the
 * hover just asked for. Both of those are scrolls; only one of them means "the citation moved".
 */
describe('scrolling', () => {
    const scroll = (node) => fireEvent.scroll(node, {});

    it('stays open when the references panel scrolls to the hovered entry', () => {
        const { onMouseLeave } = setup();
        const panel = document.createElement('div');
        panel.className = 'references-list';
        document.body.appendChild(panel);

        scroll(panel);

        expect(onMouseLeave).not.toHaveBeenCalled();
        panel.remove();
    });

    it('stays open when the pointer scrolls the card itself', () => {
        const { onMouseLeave } = setup();

        scroll(document.querySelector('.ref-hover-card'));

        expect(onMouseLeave).not.toHaveBeenCalled();
    });

    it('closes when the column the citation lives in scrolls', () => {
        const { onMouseLeave } = setup();
        const column = document.createElement('div');
        document.body.appendChild(column);

        scroll(column);

        expect(onMouseLeave).toHaveBeenCalled();
        column.remove();
    });

    /**
     * It used to re-place itself against the citation on every scroll. Opening the card
     * re-renders the answer and replaces the citation's node, so that measured a detached
     * element: an all-zero rect, which `place` reads as the top-left corner.
     */
    it('does not move when the panel scrolls', () => {
        setup();
        const card = document.querySelector('.ref-hover-card');
        const before = { top: card.style.top, left: card.style.left };
        const panel = document.createElement('div');
        panel.className = 'references-list';
        document.body.appendChild(panel);

        scroll(panel);

        expect({ top: card.style.top, left: card.style.left }).toEqual(before);
        expect(card.style.top).not.toBe('8px');
        panel.remove();
    });
});

/**
 * The point of `direct_citations`: a paper cited twice for two different sentences must show
 * the sentence that belongs to *this* chip. Before it, both chips read the reference's own
 * `evidence`, which is one blob per paper — so both showed the same quote.
 */
describe('per-citation evidence', () => {
    const passage = (quote) => ({ marker: 'c1', pmid: REFERENCE.pmid, quote, verified: true });

    it('shows the passage bound to this citation, not the paper-level evidence', () => {
        setup({ citation: passage('Induction of apoptosis depends strictly on p53 function.') });

        // The card wraps a quote in typographic marks, so these match on the text inside.
        expect(screen.getByText(/depends strictly on p53 function/)).toBeInTheDocument();
        expect(screen.queryByText(/HLA-I hyperexpression/)).not.toBeInTheDocument();
    });

    it('gives two citations of one paper their own quotes', () => {
        const first = render(
            <ReferenceHoverCard
                reference={REFERENCE}
                citation={passage('First supporting sentence.')}
                number={10}
                anchorRect={{ left: 400, top: 500, bottom: 516, width: 20, height: 16 }}
                onMouseLeave={() => {}}
            />,
        );
        expect(screen.getByText(/First supporting sentence/)).toBeInTheDocument();
        first.unmount();

        setup({ citation: passage('Second supporting sentence.') });
        expect(screen.getByText(/Second supporting sentence/)).toBeInTheDocument();
        expect(screen.queryByText(/First supporting sentence/)).not.toBeInTheDocument();
    });

    it('falls back to the paper evidence when nothing is bound to this spot', () => {
        setup({ citation: null });
        expect(screen.getByText(/HLA-I hyperexpression/)).toBeInTheDocument();
    });

    it('falls back when the binding carries an empty quote', () => {
        setup({ citation: passage('   ') });
        expect(screen.getByText(/HLA-I hyperexpression/)).toBeInTheDocument();
    });
});
