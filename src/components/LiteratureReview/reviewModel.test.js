import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
    countWords, expandCitation, linkCitations, minutesLeft, parseReview, reviewAudit, stageFill,
} from './reviewModel';
import ReviewDocument from './ReviewDocument';

// The shape a finished review has (glkb-agent literature_review), trimmed.
const REVIEW = [
    '# Does p53 loss cause chemotherapy resistance?',
    '',
    '## Direct loss-of-function evidence',
    '',
    'Deliberate p53 disruption increases resistance to particular agents in selected models [1, 2]. '
        + 'In AML cell lines a CRISPR screen identified TP53 loss among the hits [1].',
    '',
    '## Where the evidence disagrees',
    '',
    'Other settings show sensitization instead [3–4], so the effect is not uniform across models and drugs.',
    '',
    '## References',
    '',
    '1. Targeting cell cycle and apoptosis in AML. (2023). PMID 36400926.',
    '2. p53 deficiency mediates cisplatin resistance. (2024). PMID 38894712.',
    '3. A third paper. (2019). PMID 30804404.',
    '4. A fourth paper. (2021). PMID 33668653.',
    '',
    '<!-- words 48 / target 6000; cited papers 4; fabricated citations 1 -->',
].join('\n');

describe('parseReview', () => {
    const review = parseReview(REVIEW);
    it('reads the title, the sections and the reference list', () => {
        expect(review.title).toBe('Does p53 loss cause chemotherapy resistance?');
        expect(review.sections.map((s) => [s.number, s.title])).toEqual([
            [1, 'Direct loss-of-function evidence'], [2, 'Where the evidence disagrees']]);
        expect(review.references[1]).toEqual({
            number: 2, title: 'p53 deficiency mediates cisplatin resistance', year: 2024,
            pmid: '38894712', url: 'https://pubmed.ncbi.nlm.nih.gov/38894712/' });
    });
    it("takes the pipeline's own audit from the closing comment", () => {
        expect(review.audit).toEqual({ words: 48, target: 6000, cited: 4, fabricated: 1, verified: 3 });
        expect(reviewAudit('# no audit here')).toBeNull();
    });
    it('prefers the references the service returned', () => {
        const given = [{ number: 1, pmid: 99, title: 'Given', year: 2020 }];
        expect(parseReview(REVIEW, given).references).toEqual([{ number: 1, pmid: '99', title: 'Given', year: 2020 }]);
    });
    it('counts the prose only', () => {
        expect(countWords(review)).toBe(39); // citations, headings and references left out
    });
});

describe('citations', () => {
    it('become pill links, and real links are left alone', () => {
        expect(linkCitations('a [1, 2] b [3–5] c [see](https://x.org) [7](https://y)'))
            .toBe('a [1, 2](#cite=1,2) b [3–5](#cite=3,4,5) c [see](https://x.org) [7](https://y)');
        expect(expandCitation('2, 4-6')).toEqual([2, 4, 5, 6]);
    });
});

describe('progress', () => {
    it('fills the stages before the current one and part of it', () => {
        expect(stageFill(57.5, 'synthesis')).toEqual([1, 0.5, 0, 0]);
    });
    it('estimates the time left only once it means something', () => {
        expect(minutesLeft(5, 120)).toBeNull();
        expect(minutesLeft(50, 300)).toBe(5);
    });
});

describe('ReviewDocument', () => {
    it("shows the audit's numbers, previews a citation, and hands a paragraph to an action", () => {
        const onAction = jest.fn();
        render(<ReviewDocument markdown={REVIEW} meta={{ generated: 'Oct 9, 2026', minutes: 9 }} onAction={onAction} />);
        expect(screen.getByText('Citations verified').nextSibling).toHaveTextContent('3');
        expect(screen.getByText('Needs review').nextSibling).toHaveTextContent('1');
        expect(screen.getByText('Generated Oct 9, 2026 · 9 min')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Direct loss-of-function evidence/ })).toBeInTheDocument();

        fireEvent.mouseEnter(screen.getByRole('button', { name: 'References 1, 2' }));
        expect(screen.getByRole('tooltip')).toHaveTextContent('p53 deficiency mediates cisplatin resistance');

        fireEvent.click(screen.getAllByRole('button', { name: 'Rewrite' })[0]);
        expect(onAction.mock.calls[0][0].id).toBe('rewrite');
        expect(onAction.mock.calls[0][1]).toMatch(/^Deliberate p53 disruption/);
    });
});
