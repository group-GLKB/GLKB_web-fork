import { isIndexablePath, canonicalUrlFor, BLOG_SLUGS, DOC_SLUGS } from './publicSeo';

test('indexes only named public pages, including articles and documentation', () => {
    ['/', '/privacy', '/terms', '/api-docs', ...BLOG_SLUGS.map(slug => `/blog/${slug}`), ...DOC_SLUGS.map(slug => `/api-docs/${slug}`)]
        .forEach(path => expect(isIndexablePath(path)).toBe(true));
    ['/chat', '/chat/private-id', '/history', '/library', '/account', '/api-page', '/search', '/literature-review/private', '/blog/missing', '/api-docs/missing']
        .forEach(path => expect(isIndexablePath(path)).toBe(false));
    expect(isIndexablePath('/api-docs', false)).toBe(false);
});
test('normalizes legacy aliases and trailing slashes to the canonical content', () => {
    expect(canonicalUrlFor('/about/')).toBe('https://glkb.org/');
    expect(canonicalUrlFor('/blog')).toBe('https://glkb.org/');
    expect(canonicalUrlFor('/api-docs/overview')).toBe('https://glkb.org/api-docs');
    expect(canonicalUrlFor('/api-docs/quickstart/')).toBe('https://glkb.org/api-docs/quickstart');
});
