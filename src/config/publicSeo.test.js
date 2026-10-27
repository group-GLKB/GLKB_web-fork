import { isIndexablePath, canonicalUrlFor, BLOG_SLUGS, DOC_SLUGS } from './publicSeo';

test('indexes named public pages and articles, excluding all API documentation', () => {
    ['/', '/privacy', '/terms', '/contact', ...BLOG_SLUGS.map(slug => `/blog/${slug}`)]
        .forEach(path => expect(isIndexablePath(path)).toBe(true));
    ['/chat', '/chat/private-id', '/history', '/library', '/account', '/api-page', '/search', '/literature-review/private', '/blog/missing', '/api-docs/missing', '/api-docs', '/api-docs/', ...DOC_SLUGS.flatMap(slug => [`/api-docs/${slug}`, `/api-docs/${slug}/`])]
        .forEach(path => expect(isIndexablePath(path)).toBe(false));
});
test('normalizes legacy aliases and trailing slashes to the canonical content', () => {
    expect(canonicalUrlFor('/about/')).toBe('https://glkb.org/');
    expect(canonicalUrlFor('/blog')).toBe('https://glkb.org/');
    expect(canonicalUrlFor('/api-docs/overview')).toBe('https://glkb.org/api-docs');
    expect(canonicalUrlFor('/api-docs/quickstart/')).toBe('https://glkb.org/api-docs/quickstart');
});
