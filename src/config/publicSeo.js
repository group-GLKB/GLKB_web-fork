// Index only selected public content. API documentation remains accessible but is not indexed.
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
export const isIndexablePath = path => {
    const normalized = normalizeSeoPath(path);
    return ['/', '/privacy', '/terms', '/contact'].includes(normalized)
        || BLOG_SLUGS.some(slug => normalized === `/blog/${slug}`);
};
export const canonicalUrlFor = path => `https://glkb.org${canonicalPathFor(path) === '/' ? '/' : canonicalPathFor(path)}`;
