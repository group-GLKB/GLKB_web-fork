import quickstartMd from './docs/quickstart.md';
import howGlkbWorksMd from './docs/how-glkb-works.md';
import theBatchPatternMd from './docs/the-batch-pattern.md';
import promptTemplatesMd from './docs/prompt-templates.md';
import geneListPrioritizationMd from './docs/gene-list-prioritization.md';
import annotatingExperimentalResultsMd from './docs/annotating-experimental-results.md';
import drugTargetInvestigationMd from './docs/drug-target-investigation.md';
import variantAndGwasInterpretationMd from './docs/variant-and-gwas-interpretation.md';
import batchEndpointMd from './docs/batch-endpoint.md';
import healthCheckMd from './docs/health-check.md';

export const DOCS_CATEGORIES = [
    {
        id: 'get-started',
        label: 'Get Started',
        pages: [
            {
                slug: 'overview',
                title: 'Overview',
                layout: 'overview-landing',
                description: 'Run your first literature query in minutes.',
            },
            {
                slug: 'quickstart',
                title: 'Get Started with GLKB',
                markdown: quickstartMd,
                description: 'Make your first API call with production-ready patterns.',
            },
        ],
    },
    {
        id: 'core-concepts',
        label: 'Core Concepts',
        pages: [
            {
                slug: 'how-glkb-works',
                title: 'How GLKB Works',
                markdown: howGlkbWorksMd,
                description: 'Retrieval, reasoning, and citation guarantees.',
            },
            {
                slug: 'the-batch-pattern',
                title: 'The Batch Pattern',
                description: 'How to structure high-throughput and deterministic batch jobs.',
                markdown: theBatchPatternMd,
            },
            {
                slug: 'prompt-templates',
                title: 'Prompt Templates',
                description: 'Template strategies for structured and reproducible outputs.',
                markdown: promptTemplatesMd,
            },
        ],
    },
    {
        id: 'use-cases',
        label: 'Use Cases',
        pages: [
            {
                slug: 'gene-list-prioritization',
                title: 'Gene List Prioritization',
                markdown: geneListPrioritizationMd,
            },
            {
                slug: 'annotating-experimental-results',
                title: 'Annotating Experimental Results',
                markdown: annotatingExperimentalResultsMd,
            },
            {
                slug: 'drug-target-investigation',
                title: 'Drug Target Investigation',
                markdown: drugTargetInvestigationMd,
            },
            {
                slug: 'variant-and-gwas-interpretation',
                title: 'Variant & GWAS Interpretation',
                markdown: variantAndGwasInterpretationMd,
            },
            {
                slug: 'use-case-gallery',
                title: 'Use Case Gallery',
                layout: 'use-case-gallery',
                description: 'Browse common workflows and jump into detailed guides.',
            },
        ],
    },
    {
        id: 'api-reference',
        label: 'API Reference',
        pages: [
            {
                slug: 'batch-endpoint',
                title: 'Batch Endpoint',
                description: 'Draft placeholder for endpoint schema and examples.',
                markdown: batchEndpointMd,
            },
            {
                slug: 'health-check',
                title: 'Health Check',
                description: 'Draft placeholder for uptime and status semantics.',
                markdown: healthCheckMd,
            },
        ],
    },
];

export const flattenDocsPages = (categories) => categories.flatMap((category) =>
    category.pages.map((page) => ({
        ...page,
        categoryId: category.id,
        categoryLabel: category.label,
    }))
);
