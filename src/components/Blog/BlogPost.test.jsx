/**
 * The articles moved from hand-built block objects to markdown files. The point
 * of this test is that the move changed nothing a reader sees: it renders both
 * posts and compares the article markup against a fixture captured from the
 * block renderer, which was itself checked against Figma.
 *
 * Refresh the fixtures deliberately, never casually:
 *   UPDATE_FIXTURES=1 npx craco test --watchAll=false BlogPost
 */
import fs from 'fs';
import path from 'path';

import { posts } from './posts';
import renderArticle from './__fixtures__/renderArticle';

const FIXTURES = path.join(__dirname, '__fixtures__');

/** Pretty-print so a diff points at the block that moved, not one long line. */
const readable = (html) => html
    .replace(/></g, '>\n<')
    .replace(/\n<\//g, '</');

describe('rendered article markup', () => {
    posts.forEach((post) => {
        it(`${post.slug} renders exactly as it did before markdown`, () => {
            const container = renderArticle(post.slug);
            const article = container.querySelector('.blog-body');
            expect(article).toBeTruthy();

            const actual = readable(article.innerHTML);
            const fixture = path.join(FIXTURES, `${post.slug}.html`);

            if (process.env.UPDATE_FIXTURES) {
                fs.writeFileSync(fixture, `${actual}\n`, 'utf8');
                return;
            }

            // Line endings are git's business, not the markup's: a Windows
            // checkout materialises the fixture as CRLF and every line would
            // otherwise read as changed.
            const committed = fs.readFileSync(fixture, 'utf8').replace(/\r\n/g, '\n').trimEnd();
            expect(actual).toEqual(committed);
        });
    });
});
