// Public content only. Never index individual chats, account pages or saved libraries.
export const DOC_SLUGS = ['overview', 'quickstart', 'how-glkb-works', 'the-batch-pattern',
    'prompt-templates', 'gene-list-prioritization', 'annotating-experimental-results',
    'drug-target-investigation', 'variant-and-gwas-interpretation', 'use-case-gallery',
    'batch-endpoint', 'health-check'];
export const BLOG_SLUGS = ['glkb-knowledge-graph', 'investigate-auditable-research'];
export const normalizeSeoPath = path => path.replace(/\/+$/, '') || '/';
export const canonicalPathFor = path => {
    const normalized = normalizeSeoPath(path);
    if (normalized === '/about' || normalized === '/blog') return '/';
    if (normalized === '/api-docs/overview') return '/api-docs';
    return normalized;
};
export const isIndexablePath = (path, docsEnabled = true) => {
    const normalized = normalizeSeoPath(path);
    return ['/', '/privacy', '/terms', '/contact'].includes(normalized)
        || BLOG_SLUGS.some(slug => normalized === `/blog/${slug}`)
        || (docsEnabled && (normalized === '/api-docs' || DOC_SLUGS.some(slug => normalized === `/api-docs/${slug}`)));
};
export const canonicalUrlFor = path => `https://glkb.org${canonicalPathFor(path) === '/' ? '/' : canonicalPathFor(path)}`;
