/**
 * The dialect itself. The articles' own rendering is covered by BlogPost.test,
 * which diffs the whole page; these are the edge cases that diff would not
 * reach, and the notation an author has to get right when editing a post.
 */
import { parseArticle, parseFrontMatter, parseSegments, unescape } from './markdown';

describe('front matter', () => {
    it('reads scalars, a link and the nested table of contents', () => {
        const { meta, body } = parseFrontMatter([
            '---',
            'slug: a-post',
            "kicker: GLKB · product article",
            'cta: [Try GLKB →](/)',
            'toc:',
            '  - [At a Glance](#at-a-glance)',
            '  - [Overview](#overview)',
            '    - [The Gap](#the-gap)',
            '---',
            '',
            '# Title',
        ].join('\n'));

        expect(meta.slug).toBe('a-post');
        expect(meta.kicker).toBe('GLKB · product article');
        expect(meta.cta).toEqual({ label: 'Try GLKB →', to: '/' });
        expect(meta.toc).toEqual([
            [{ id: 'at-a-glance', label: 'At a Glance' }],
            [
                { id: 'overview', label: 'Overview' },
                { id: 'the-gap', label: 'The Gap', child: true },
            ],
        ]);
        expect(body).toBe('# Title');
    });

    it('leaves a file without front matter alone', () => {
        expect(parseFrontMatter('# Title\n').meta).toEqual({});
    });
});

describe('containers', () => {
    it('lifts a callout out of the prose around it', () => {
        expect(parseSegments('before\n\n:::callout A Title\nThe body.\n:::\n\nafter'))
            .toEqual([
                { type: 'markdown', content: 'before' },
                { type: 'callout', title: 'A Title', content: 'The body.' },
                { type: 'markdown', content: 'after' },
            ]);
    });

    it('splits a sample into its note, body and footer', () => {
        const [segment] = parseSegments([
            ':::sample SAMPLE OUTPUT',
            '> A note.',
            '',
            '#### Direct answer',
            '',
            'The answer.',
            '',
            '---',
            'counts and timings',
            ':::',
        ].join('\n'));

        expect(segment).toEqual({
            type: 'sample',
            label: 'SAMPLE OUTPUT',
            note: 'A note.',
            body: '#### Direct answer\n\nThe answer.',
            footer: 'counts and timings',
        });
    });

    it('keeps a sample without a note or footer', () => {
        const [segment] = parseSegments(':::sample Label\nJust a body.\n:::');
        expect(segment.note).toBeNull();
        expect(segment.footer).toBeNull();
        expect(segment.body).toBe('Just a body.');
    });

    it('treats an unclosed container as prose rather than eating the article', () => {
        expect(parseSegments(':::callout Oops\nstill writing'))
            .toEqual([{ type: 'markdown', content: ':::callout Oops\nstill writing' }]);
    });
});

describe('the hero', () => {
    const source = [
        '---',
        'slug: a-post',
        '---',
        '',
        '# The Title',
        '',
        'The lede paragraph.',
        '',
        '## First Section {#first}',
        '',
        'Body text.',
    ].join('\n');

    it('takes the h1 and the paragraph under it out of the body', () => {
        const post = parseArticle(source);
        expect(post.title).toBe('The Title');
        expect(post.lede).toBe('The lede paragraph.');
        expect(post.segments).toEqual([
            { type: 'markdown', content: '## First Section {#first}\n\nBody text.' },
        ]);
    });
});

describe('escaping', () => {
    it('restores characters the prose had to escape for markdown', () => {
        expect(unescape('a \\[bracket\\] and an \\*asterisk\\*')).toBe('a [bracket] and an *asterisk*');
    });
});

describe('the GLKB Cite guide', () => {
    // Written for readers who do not use a Terminal: this build is signed and notarized, so
    // none of the app's own guide's command-line workarounds belong in it.
    const { posts } = require('./posts');
    const renderArticle = require('./__fixtures__/renderArticle').default;
    const guide = posts.find((post) => post.slug === 'glkb-cite');
    const source = guide.segments.map((segment) => [segment.title, segment.content].filter(Boolean).join('\n')).join('\n');

    it('has no command-line instructions', () => {
        expect(source).not.toMatch(/terminal|xattr|quarantine|defaults (write|delete)|```/i);
    });

    it('gives every entry of its contents rail a heading to land on', () => {
        const anchors = guide.toc.flat().map((item) => item.id);
        expect(anchors.length).toBeGreaterThan(15);
        anchors.forEach((anchor) => expect(source).toContain(`{#${anchor}}`));
    });

    it('sends its download links to the GLKB Cite page through the router, and its figures have captions', () => {
        const container = renderArticle('glkb-cite');
        const downloads = [...container.querySelectorAll('.blog-article a[href="/cite"]')];
        expect(downloads.length).toBeGreaterThanOrEqual(2);
        const figures = [...container.querySelectorAll('.blog-article figure')];
        expect(figures).toHaveLength(8);
        figures.forEach((figure) => {
            expect(figure.querySelector('figcaption').textContent.length).toBeGreaterThan(20);
            expect(figure.querySelector('img').getAttribute('alt')).toBeTruthy();
        });
        // In-page links name sections that exist.
        [...container.querySelectorAll('.blog-article a[href^="#"]')].forEach((link) => {
            expect(container.querySelector(link.getAttribute('href'))).not.toBeNull();
        });
    });
});
