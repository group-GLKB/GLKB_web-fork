import React from 'react';

const USE_CASE_CARDS = [
    {
        slug: 'gene-list-prioritization',
        title: 'Gene List Prioritization',
        input: '1,500 candidate genes from a screen or GWAS',
        output: 'Literature score + evidence + PMIDs per gene',
    },
    {
        slug: 'annotating-experimental-results',
        title: 'Annotating Experimental Results',
        input: 'RNA-seq DEGs or proteomics hit lists',
        output: 'Function and disease context with evidence references',
    },
    {
        slug: 'drug-target-investigation',
        title: 'Drug Target Investigation',
        input: '50 candidate kinase targets',
        output: 'Mechanism, genetics context, and cited summaries',
    },
    {
        slug: 'variant-and-gwas-interpretation',
        title: 'Variant & GWAS Interpretation',
        input: 'Fine-mapped locus genes or gene:variant strings',
        output: 'Functional interpretation with PMIDs',
    },
];

const UseCaseGallery = ({ navigate }) => {
    return (
        <div className="api-docs-gallery-wrap">
            <div className="api-docs-gallery-content">
                <header className="api-docs-gallery-header">
                    <h1>Use Case Gallery</h1>
                    <p>
                        Start from a workflow pattern and jump to the detailed guide for input shape,
                        output expectation, and execution pattern.
                    </p>
                </header>

                <section className="api-docs-gallery-grid" aria-label="Use case cards">
                    {USE_CASE_CARDS.map((card) => (
                        <article key={card.slug} className="api-docs-gallery-card">
                            <h2>{card.title}</h2>
                            <div className="api-docs-gallery-meta">
                                <h3>Input</h3>
                                <p>{card.input}</p>
                            </div>
                            <div className="api-docs-gallery-meta">
                                <h3>Output</h3>
                                <p>{card.output}</p>
                            </div>
                            <button
                                type="button"
                                className="api-docs-pill-btn primary"
                                onClick={() => navigate(`/api-docs/${card.slug}`)}
                            >
                                Open Guide
                            </button>
                        </article>
                    ))}
                </section>
            </div>

            <aside className="api-docs-gallery-rail" aria-hidden="true" />
        </div>
    );
};

export default UseCaseGallery;