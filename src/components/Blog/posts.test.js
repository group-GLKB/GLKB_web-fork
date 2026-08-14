/**
 * The blog articles are transcriptions, not writing. Every word a reader sees
 * has to come from the Figma frame — an invented sentence in an article about
 * verifiable citations is exactly the failure the articles describe.
 *
 * So: walk both post objects, and assert every string appears in the design.
 */
import fs from 'fs';
import path from 'path';

import { posts } from './posts';

const DIVIDER = '#####';

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

/** Every string a reader would see, ignoring keys that hold ids and paths. */
const visibleStrings = (post) => {
    const skip = new Set(['slug', 'readNext', 'id', 'kind', 'src', 'to']);
    const found = [];
    const walk = (value) => {
        if (typeof value === 'string') {
            if (value.length > 3) found.push(value);
        } else if (Array.isArray(value)) {
            value.forEach(walk);
        } else if (value && typeof value === 'object') {
            Object.entries(value).forEach(([key, child]) => {
                if (!skip.has(key)) walk(child);
            });
        }
    };
    walk(post);
    return found;
};

describe('blog post content', () => {
    const design = designText();

    posts.forEach((post) => {
        it(`${post.slug} says only what the design says`, () => {
            const haystack = design[post.slug];
            expect(haystack).toBeTruthy();

            const invented = visibleStrings(post)
                .filter((value) => !haystack.includes(normalize(value)));

            expect(invented).toEqual([]);
        });
    });

    it('covers both designed posts', () => {
        expect(posts.map((post) => post.slug).sort()).toEqual([
            'glkb-knowledge-graph',
            'investigate-auditable-research',
        ]);
    });
});
