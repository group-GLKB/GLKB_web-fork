import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';

import { repairOrphanSingleItemMarkdown } from './markdownRendering';

describe('repairOrphanSingleItemMarkdown', () => {
    it('reattaches an orphaned single bullet to its following paragraph', () => {
        const markdown = repairOrphanSingleItemMarkdown(
            '- \n\n*Bottom line:* * Across multiple sources',
        );
        const html = renderToStaticMarkup(<ReactMarkdown>{markdown}</ReactMarkdown>);

        expect(html).toBe(
            '<ul>\n<li><em>Bottom line:</em> Across multiple sources</li>\n</ul>',
        );
    });

    it('does not change an ordinary single-item list', () => {
        const markdown = repairOrphanSingleItemMarkdown('- One valid item');
        const html = renderToStaticMarkup(<ReactMarkdown>{markdown}</ReactMarkdown>);

        expect(html).toBe('<ul>\n<li>One valid item</li>\n</ul>');
    });
});
