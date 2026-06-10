import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import ContentCopyIcon from '@mui/icons-material/ContentCopy';

export const USE_CASE_SECTIONS = [
    {
        id: 'genomics-genetics',
        title: 'Genomics & Genetics',
        tone: 'genomics',
        entries: [
            {
                id: 1,
                audience: 'Clinical geneticists, rare disease researchers',
                title: 'Rare disease phenotype-to-gene matching',
                description:
                    'Given candidate genes from exome sequencing, ask whether each has published associations with the phenotype in question. Genes with convergent evidence across human genetics and model organisms rise to the top; zero-literature genes are explicitly flagged.',
                prompt:
                    'Does {item} have published associations with [HPO terms]?\nReturn: gene, human phenotype evidence, mouse KO phenotype, OMIM entry, PMIDs.',
            },
            {
                id: 2,
                audience: 'Clinical pharmacologists, precision medicine teams',
                title: 'Pharmacogenomics - drug-gene interaction triage',
                description:
                    'For a 120-gene pharmacogenomics panel, retrieve which drug classes interact with each gene, the clinical consequence (efficacy or toxicity), and whether PharmGKB or CPIC guidelines exist.',
                prompt:
                    'For the pharmacogene {item}, what drug classes interact with it?\nReturn: gene, interacting drugs, clinical effect (efficacy/toxicity), guideline level, PMIDs.',
            },
            {
                id: 3,
                audience: 'Clinical cytogeneticists, rare disease researchers',
                title: 'Copy number variant gene content annotation',
                description:
                    'For each gene within a CNV, retrieve haploinsufficiency context, dominant disease associations, and any published CNV cases at that locus.',
                prompt:
                    'Is {item} known to be dosage-sensitive or haploinsufficient?\nReturn: gene, dominant disease, CNV literature, DECIPHER/ClinGen evidence, PMIDs.',
            },
        ],
    },
    {
        id: 'cancer-biology',
        title: 'Cancer Biology',
        tone: 'cancer',
        entries: [
            {
                id: 4,
                audience: 'Cancer biologists, translational oncology teams',
                title: 'Oncogene / tumor suppressor classification',
                description:
                    'Classify each gene from a cancer DEG list as oncogene, tumor suppressor, passenger, or unknown, with the strongest supporting evidence in the cancer type of interest.',
                prompt:
                    'In the context of [cancer type], is {item} an oncogene, tumor suppressor, or unknown?\nReturn: gene, classification, strongest evidence sentence, cancer type specificity, PMIDs.',
            },
            {
                id: 5,
                audience: 'Immuno-oncology researchers',
                title: 'Tumor microenvironment marker annotation',
                description:
                    'For marker genes from a single-cell TME dataset, retrieve which cell type each marks, whether it is a checkpoint or immunosuppressive factor, and whether it has been explored as a therapeutic target.',
                prompt:
                    'Is {item} a known marker of immune or stromal cell subsets in the tumor microenvironment?\nIs it a checkpoint or immunosuppressive target?\nReturn: gene, cell type, immune function, therapeutic relevance, PMIDs.',
            },
            {
                id: 6,
                audience: 'Cancer genomics researchers',
                title: 'Cancer driver vs. passenger gene triage',
                description:
                    "For recurrently mutated genes from somatic mutation analysis, retrieve functional evidence - pathway membership, hotspot context, mouse model data - and score each gene's likelihood of being a driver.",
                prompt:
                    'In [cancer type], is {item} a likely driver gene based on published functional evidence?\nReturn: gene, driver evidence, pathway, hotspot context, PMIDs, driver probability: High/Med/Low.',
            },
        ],
    },
    {
        id: 'neuro-complex',
        title: 'Neuroscience & Complex Disease',
        tone: 'neuro',
        entries: [
            {
                id: 7,
                audience: 'Neurodegeneration researchers',
                title: "Alzheimer's / Parkinson's candidate gene scoring",
                description:
                    "For each candidate gene from GWAS or multi-omics, retrieve expression in the relevant brain cell type, known role in protein aggregation or clearance, and functional validation in disease models.",
                prompt:
                    "Does {item} have published evidence for a role in Alzheimer's or Parkinson's disease?\nReturn: gene, cell-type expression, aggregation/clearance role, disease model evidence, PMIDs.",
            },
            {
                id: 8,
                audience: 'Immunology researchers, translational immunologists',
                title: 'Autoimmune GWAS locus functional annotation',
                description:
                    'For fine-mapped loci from an autoimmune GWAS, retrieve immune cell expression, known role in JAK-STAT / NF-kB / TCR/BCR signaling, and any human genetic evidence beyond the GWAS signal.',
                prompt:
                    'Does {item} have evidence for a functional role in T cell, B cell, or macrophage biology relevant to autoimmune disease?\nReturn: gene, immune cell expression, signaling pathway, autoimmune evidence, PMIDs.',
            },
            {
                id: 9,
                audience: 'Psychiatric genetics researchers, clinical genomics',
                title: 'Psychiatric disorder polygenic risk gene interpretation',
                description:
                    'For top-ranked genes from a PRS model, retrieve synaptic function, neurodevelopmental role, and enrichment in brain eQTL datasets to support mechanistic hypothesis generation.',
                prompt:
                    'What is the published functional role of {item} in brain development or synaptic biology?\nIs it associated with schizophrenia, bipolar disorder, or ASD in genetic studies?\nReturn: gene, brain function, psychiatric genetic evidence, eQTL context, PMIDs.',
            },
        ],
    },
    {
        id: 'experimental-follow-up',
        title: 'Experimental Follow-up',
        tone: 'experimental',
        entries: [
            {
                id: 10,
                audience: 'Proteomics researchers, cell biologists',
                title: 'Proteomics hit functional annotation',
                description:
                    'For proteins that change in abundance under a perturbation, retrieve known function in the biological context, key interaction partners, and whether any published study has validated it in a similar model.',
                prompt:
                    'What is the known function of {item} in [biological process or cell type]?\nDoes it have known interaction partners relevant to [pathway]?\nReturn: protein, function, key interactors, relevant experimental evidence, PMIDs.',
            },
            {
                id: 11,
                audience: 'Translational researchers, clinical teams',
                title: 'Biomarker candidate clinical evidence validation',
                description:
                    'For circulating biomarker candidates, retrieve whether each has been measured in patient blood/serum before, disease association evidence, and any published sensitivity/specificity estimates.',
                prompt:
                    'Has {item} been studied as a circulating biomarker for [disease]?\nReturn: gene/protein, biomarker evidence, specimen type, clinical association, PMIDs.',
            },
            {
                id: 12,
                audience: 'Any researcher prioritizing targets or biomarkers',
                title: 'Cross-tissue expression specificity check',
                description:
                    'For a list of candidates, retrieve published evidence on expression pattern across tissues and cell types. Highly ubiquitous genes are deprioritized; tissue-restricted ones advance.',
                prompt:
                    'Based on published literature, is {item} expressed broadly across human tissues or restricted to specific cell types? Flag if ubiquitous.\nReturn: gene, expression pattern, most specific cell type, PMIDs.',
            },
        ],
    },
];

const NAV_ITEMS = USE_CASE_SECTIONS.flatMap((section) =>
    section.entries.map((entry) => ({
        id: `use-case-${entry.id}`,
        label: `${entry.id}. ${entry.title}`,
    }))
);

const UseCaseGallery = () => {
    const [copiedPromptId, setCopiedPromptId] = useState(null);
    const [activeNavId, setActiveNavId] = useState(NAV_ITEMS[0]?.id || '');
    const [indexMenuOpen, setIndexMenuOpen] = useState(false);
    const galleryRootRef = useRef(null);
    const indexMenuTimersRef = useRef({ open: null, close: null });

    useEffect(() => {
        if (NAV_ITEMS.length === 0) return;
        setActiveNavId(NAV_ITEMS[0].id);
    }, []);

    useEffect(() => {
        const root = galleryRootRef.current;
        const scrollContainer = root?.closest('.api-docs-content-pane');
        if (!scrollContainer || NAV_ITEMS.length === 0) return undefined;

        const syncActiveItem = () => {
            const containerTop = scrollContainer.getBoundingClientRect().top;
            const threshold = 160;
            let currentId = NAV_ITEMS[0].id;

            NAV_ITEMS.forEach((item) => {
                const element = document.getElementById(item.id);
                if (!element) return;
                const top = element.getBoundingClientRect().top - containerTop;
                if (top <= threshold) {
                    currentId = item.id;
                }
            });

            setActiveNavId(currentId);
        };

        syncActiveItem();
        scrollContainer.addEventListener('scroll', syncActiveItem);
        return () => scrollContainer.removeEventListener('scroll', syncActiveItem);
    }, []);

    useEffect(() => () => {
        if (indexMenuTimersRef.current.open) clearTimeout(indexMenuTimersRef.current.open);
        if (indexMenuTimersRef.current.close) clearTimeout(indexMenuTimersRef.current.close);
    }, []);

    const openIndexMenuWithDelay = () => {
        if (indexMenuTimersRef.current.close) {
            clearTimeout(indexMenuTimersRef.current.close);
            indexMenuTimersRef.current.close = null;
        }
        if (indexMenuOpen) return;
        if (!indexMenuTimersRef.current.open) {
            indexMenuTimersRef.current.open = setTimeout(() => {
                setIndexMenuOpen(true);
                indexMenuTimersRef.current.open = null;
            }, 140);
        }
    };

    const closeIndexMenuWithDelay = () => {
        if (indexMenuTimersRef.current.open) {
            clearTimeout(indexMenuTimersRef.current.open);
            indexMenuTimersRef.current.open = null;
        }
        if (!indexMenuOpen) return;
        if (!indexMenuTimersRef.current.close) {
            indexMenuTimersRef.current.close = setTimeout(() => {
                setIndexMenuOpen(false);
                indexMenuTimersRef.current.close = null;
            }, 260);
        }
    };

    const activeNavIndex = Math.max(0, NAV_ITEMS.findIndex((item) => item.id === activeNavId));

    const handleNavClick = (targetId) => {
        const target = document.getElementById(targetId);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleCopyPrompt = async (entryId, prompt) => {
        try {
            await navigator.clipboard.writeText(prompt);
            setCopiedPromptId(entryId);
            setTimeout(() => setCopiedPromptId(null), 1200);
        } catch {
            setCopiedPromptId(null);
        }
    };

    return (
        <div ref={galleryRootRef} className="api-docs-gallery-wrap">
            <div className="api-docs-markdown-wrap">
                <article className="api-docs-content api-docs-gallery-content">
                <header className="api-docs-gallery-header">
                    <h1>Use Case Gallery</h1>
                    <p>
                        Twelve more workflows, one batch endpoint.
                    </p>
                    <p>
                        Each entry below is a complete use case: audience, what you send,
                        and a prompt sketch ready to adapt. The infrastructure is identical
                        to the four main guides: a list of items, a prompt template,
                        and a streaming batch request.
                    </p>
                </header>

                {USE_CASE_SECTIONS.map((section) => (
                    <section
                        key={section.id}
                        className="api-docs-gallery-section"
                        aria-label={section.title}
                    >
                        <h2>{section.title}</h2>
                        <div className="api-docs-gallery-section-list">
                            {section.entries.map((entry) => (
                                <article
                                    id={`use-case-${entry.id}`}
                                    key={entry.id}
                                    className="api-docs-gallery-entry-row"
                                >
                                    <div className={`api-docs-gallery-entry-card ${section.tone}`}>
                                        <div className="api-docs-gallery-entry-head">
                                            <span className={`api-docs-gallery-tag ${section.tone}`}>
                                                {entry.audience}
                                            </span>
                                            <span className="api-docs-gallery-index">{entry.id}</span>
                                        </div>
                                        <h3>{entry.title}</h3>
                                        <p>{entry.description}</p>
                                    </div>
                                    <div className="api-docs-gallery-prompt-card">
                                        <div className="api-docs-gallery-prompt-header">
                                            <span>prompt sketch</span>
                                            <button
                                                type="button"
                                                className="api-docs-copy-btn"
                                                onClick={() => handleCopyPrompt(entry.id, entry.prompt)}
                                                aria-label={copiedPromptId === entry.id ? 'Copied' : 'Copy prompt sketch'}
                                                title={copiedPromptId === entry.id ? 'Copied' : 'Copy prompt sketch'}
                                            >
                                                <ContentCopyIcon fontSize="inherit" />
                                            </button>
                                        </div>
                                        <pre>
                                            <code>{entry.prompt}</code>
                                        </pre>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                ))}

                <div className="api-docs-gallery-end-space" aria-hidden="true" />
                </article>
            </div>

            <aside className="api-docs-index-rail" aria-label="Use case navigator">
                <div
                    className="api-docs-index-hover-wrap"
                    onMouseEnter={openIndexMenuWithDelay}
                    onMouseLeave={closeIndexMenuWithDelay}
                >
                    <nav className={`api-docs-index-menu${indexMenuOpen ? ' visible' : ''}`}>
                        {NAV_ITEMS.map((item) => {
                            const isActive = item.id === activeNavId;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={`api-docs-index-menu-item${isActive ? ' active' : ''}`}
                                    title={item.label}
                                    aria-label={item.label}
                                    onClick={() => handleNavClick(item.id)}
                                >
                                    <span className="api-docs-index-menu-item-label">{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>

                    <button
                        type="button"
                        className="api-docs-index-compact"
                        aria-label={`Section ${activeNavIndex + 1} of ${NAV_ITEMS.length}`}
                    >
                        <div className="api-docs-index-compact-bars" aria-hidden="true">
                            {NAV_ITEMS.map((item, idx) => (
                                <span
                                    key={item.id}
                                    className={`api-docs-index-compact-bar${idx === activeNavIndex ? ' active' : ''}`}
                                />
                            ))}
                        </div>
                    </button>
                </div>
            </aside>
        </div>
    );
};

export default UseCaseGallery;