/**
 * Markdown tables in an answer.
 *
 * Answers put repeated, comparable facts in a table now — the chat instruction and the
 * deep-research section writer both ask for one, because a list of "GENE — PD: 8532; oxidative
 * stress: 1004" bullets is a table that has been flattened into prose. Two things have to hold
 * for that to be worth doing:
 *
 *   * GFM tables parse at all (they need remark-gfm; without it the pipes render as literal text);
 *   * a wide table scrolls inside its own box rather than widening the whole conversation;
 *   * the delimiter row's alignment survives to the rendered cell, which is what lets a column of
 *     counts line up on the right.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// The same renderer the answer body installs (index.jsx). Kept here as the thing under test
// rather than imported, because it is defined inline inside a 7,000-line component.
const components = {
    table: ({ node, ...props }) => (
        <div className="markdown-table-scroll">
            <table {...props} />
        </div>
    ),
};

const render = (markdown) => renderToStaticMarkup(
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{markdown}</ReactMarkdown>,
);

const TABLE = [
    '| Gene | PD (articles) | Oxidative stress |',
    '|---|---:|---:|',
    '| SNCA | 8,532 | 1,004 |',
    '| NFE2L2 (NRF2) | 635 | 7,201 |',
].join('\n');

describe('a GFM table in an answer', () => {
    it('renders as a real table, not as literal pipes', () => {
        const html = render(TABLE);
        expect(html).toContain('<table>');
        expect(html).toContain('<th');
        expect(html).toContain('<td');
        expect(html).toContain('SNCA');
        expect(html).not.toContain('| Gene |');
    });

    it('is wrapped in its own scroll container', () => {
        // Without this a table with more columns than the message column can hold widens the
        // answer and puts a horizontal scrollbar under the whole conversation.
        const html = render(TABLE);
        expect(html).toContain('<div class="markdown-table-scroll"><table>');
    });

    it('keeps the delimiter row\'s alignment on the cells', () => {
        // `---:` is how the agent is told to mark a numeric column. The stylesheet defaults every
        // cell to left; this inline alignment is what overrides it, so losing it would leave a
        // column of counts ragged.
        const html = render(TABLE);
        expect(html).toMatch(/<th style="text-align:right">PD \(articles\)<\/th>/);
        expect(html).toMatch(/<td style="text-align:right">8,532<\/td>/);
    });

    it('leaves an unaligned column alone', () => {
        // The stylesheet used to force `text-align: right` on every column but the first,
        // regardless of what the markdown said, which put prose hard against the right edge.
        // Nothing inline should be emitted for a plain `---` column.
        const html = render([
            '| Gene | Note |',
            '|---|---|',
            '| SNCA | encodes alpha-synuclein |',
        ].join('\n'));
        expect(html).toContain('<td>encodes alpha-synuclein</td>');
        expect(html).not.toContain('text-align:right');
    });

    it('renders an inline citation link inside a cell', () => {
        const html = render([
            '| Study | Effect |',
            '|---|---:|',
            '| ACCORD [12345](https://pubmed.ncbi.nlm.nih.gov/12345) | **HR 0.78** |',
        ].join('\n'));
        expect(html).toContain('href="https://pubmed.ncbi.nlm.nih.gov/12345"');
        expect(html).toContain('<strong>HR 0.78</strong>');
    });

    it('still renders ordinary lists as lists', () => {
        const html = render('- one\n- two');
        expect(html).toContain('<ul>');
        expect(html).not.toContain('markdown-table-scroll');
    });
});
