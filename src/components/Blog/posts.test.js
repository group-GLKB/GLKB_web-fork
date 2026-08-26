/**
 * The blog articles are transcriptions, not writing. Every word a reader sees
 * has to come from the Figma frame — an invented sentence in an article about
 * verifiable citations is exactly the failure the articles describe.
 *
 * So: render both posts and assert every line of text appears in the design.
 */
import fs from 'fs';
import path from 'path';

import { posts } from './posts';
import renderArticle from './__fixtures__/renderArticle';

const DIVIDER = '#####';

/** Every element that holds a line of the article's own text. */
const TEXT_NODES = [
    'h1', 'h2', 'h3', 'h4', 'p', 'li', 'td', 'th', 'figcaption',
    '.blog-meta span', '.blog-hero-cta', '.blog-toc-link',
    '.blog-sample-label', '.blog-sample-note', '.blog-sample-footer',
].join(',');

/** Punctuation Figma and the source spell differently, plus whitespace. */
const normalize = (value) => value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/→/g, '->')
    .replace(/·/g, '.')
    .replace(/≥/g, '>=')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const designText = () => {
    const raw = fs.readFileSync(
        path.join(__dirname, '__fixtures__', 'design-text.txt'),
        'utf8',
    );
    const [first, second] = raw.split(DIVIDER);
    return {
        'glkb-knowledge-graph': normalize(first),
        'investigate-auditable-research': normalize(second),
    };
};

describe('blog post content', () => {
    const design = designText();

    posts.forEach((post) => {
        it(`${post.slug} says only what the design says`, () => {
            const haystack = design[post.slug];
            expect(haystack).toBeTruthy();

            const container = renderArticle(post.slug);
            const scope = [
                ...container.querySelectorAll('.blog-content'),
                ...container.querySelectorAll('.blog-toc'),
            ];
            expect(scope.length).toBe(2);

            const lines = scope
                .flatMap((root) => [...root.querySelectorAll(TEXT_NODES)])
                .map((node) => node.textContent)
                .filter((text) => text && text.trim().length > 3);

            expect(lines.length).toBeGreaterThan(60);
            expect(lines.filter((line) => !haystack.includes(normalize(line)))).toEqual([]);
        });
    });

    it('covers both designed posts', () => {
        expect(posts.map((post) => post.slug).sort()).toEqual([
            'glkb-knowledge-graph',
            'investigate-auditable-research',
        ]);
    });
});
