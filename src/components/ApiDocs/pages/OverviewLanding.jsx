import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ContentCopyRounded as ContentCopyRoundedIcon,
  VerifiedUserOutlined as VerifiedUserOutlinedIcon,
  ZoomOutMap as ZoomOutMapIcon,
} from '@mui/icons-material';

import dnaIcon from '../../../img/apidoc/dna.svg';
import relationIcon from '../../../img/apidoc/rel.svg';

const FormatImageBreakLeftSymbolIcon = ({ className, sx }) => (
    <span
        className={`material-symbols-outlined ${className || ''}`.trim()}
        style={{
            fontSize: sx?.fontSize ?? 20,
            color: sx?.color ?? 'inherit',
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}
        aria-hidden="true"
    >
        format_image_break_left
    </span>
);

const WHY_GLKB_ITEMS = [
    {
        title: 'Scale',
        body: 'Process hundreds of genes, variants, or drug targets in parallel. 1,500 genes in ~30 minutes.',
        icon: ZoomOutMapIcon,
    },
    {
        title: 'Reliability',
        body: 'Every claim linked to a PubMed ID. Gaps labeled "none found," never fabricated.',
        icon: VerifiedUserOutlinedIcon,
    },
    {
        title: 'Structured Output',
        body: 'Define a schema in your prompt. Unsupported fields are left empty, not guessed.',
        icon: FormatImageBreakLeftSymbolIcon,
    },
    {
        title: 'Reproducibility',
        body: 'Same Prompt + Same List -> Consistent, parseable output every time.',
        icon: ContentCopyRoundedIcon,
    },
];

const WORKFLOW_ROWS = [
    {
        workflow: 'Gene Prioritization',
        input: '1,500 candidate genes from a screen or GWAS',
        output: 'Literature score + evidence + PMIDs per gene',
    },
    {
        workflow: 'DEG Annotation',
        input: '800 differentially expressed genes from RNA-seq',
        output: 'Function, disease association, stress direction per gene',
    },
    {
        workflow: 'Drug Target Dossiers',
        input: '50 candidate kinase targets',
        output: 'Mechanism, human genetics, known modulators, clinical stage',
    },
    {
        workflow: 'GWAS Locus Interpretation',
        input: '200 fine-mapped locus genes',
        output: 'Functional evidence, model organism phenotype, priority tier',
    },
    {
        workflow: 'Variant Interpretation',
        input: 'Gene:variant strings from exome sequencing',
        output: 'Domain context, pathogenic variant literature, ClinVar context',
    },
    {
        workflow: 'Proteomics Annotation',
        input: '400 proteins from a mass-spec experiment',
        output: 'Known function, interaction partners, perturbation evidence',
    },
];

export const OVERVIEW_SEARCH_SECTIONS = [
    {
        anchorId: 'glkb-api',
        heading: 'GLKB API',
        text:
            'A researcher investigating 1,500 candidate genes cannot read 15,000 abstracts, but automating with a general LLM trades reliability for speed. GLKB addresses both: send a list of genes, variants, or drug targets and get back cited answers, grounded in 263M+ biomedical terms and live PubMed.',
    },
    {
        anchorId: 'beyond-manual-review',
        heading: 'Beyond Manual Review',
        text:
            'Manual review does not scale for high-throughput gene lists. GLKB combines speed and reliability with citations and deterministic outputs.',
    },
    {
        anchorId: 'why-glkb',
        heading: 'Why GLKB',
        text: WHY_GLKB_ITEMS.map((item) => `${item.title}: ${item.body}`).join(' '),
    },
    {
        anchorId: 'what-you-can-build',
        heading: 'What You Can Build',
        text: WORKFLOW_ROWS
            .map((row) => `${row.workflow}. What you send: ${row.input}. What you get back: ${row.output}.`)
            .join(' '),
    },
    {
        anchorId: 'knowledge-base',
        heading: 'Knowledge Base',
        text:
            'The GLKB knowledge graph is built from the full PubMed corpus and encodes gene-disease associations, pathway memberships, co-occurrence statistics, and ontology hierarchies across 263 million biomedical terms and 14.6 million relationships.',
    },
];

const NAV_ITEMS = [
    { id: 'glkb-api', label: 'GLKB API' },
    { id: 'beyond-manual-review', label: 'Beyond Manual Review' },
    { id: 'why-glkb', label: 'Why GLKB' },
    { id: 'what-you-can-build', label: 'What You Can Build' },
    { id: 'knowledge-base', label: 'Knowledge Base' },
];

const resolveImageAssetUrl = (assetPath = '') => {
    if (!assetPath || typeof assetPath !== 'string') return assetPath;
    if (/^(https?:)?\/\//i.test(assetPath) || assetPath.startsWith('data:') || assetPath.startsWith('blob:') || assetPath.startsWith('/')) {
        return assetPath;
    }

    const normalizedAssetPath = assetPath.replace(/^\.\//, '').replace(/^\/+/, '');
    const publicUrl = process.env.PUBLIC_URL || '';
    const normalizedPublicBase = publicUrl === '.'
        ? ''
        : publicUrl.replace(/\/+$/, '').replace(/^\/+/, '');
    const basePath = normalizedPublicBase ? `/${normalizedPublicBase}` : '';

    return `${window.location.origin}${basePath}/${normalizedAssetPath}`;
};

const OverviewLanding = ({ navigate }) => {
    const [activeNavId, setActiveNavId] = useState(NAV_ITEMS[0]?.id || '');
    const [indexMenuOpen, setIndexMenuOpen] = useState(false);
    const overviewRootRef = useRef(null);
    const indexMenuTimersRef = useRef({ open: null, close: null });

    useEffect(() => {
        if (NAV_ITEMS.length === 0) return;
        setActiveNavId(NAV_ITEMS[0].id);
    }, []);

    useEffect(() => {
        const root = overviewRootRef.current;
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

    return (
        <div ref={overviewRootRef} className="api-docs-overview-wrap">
            <div className="api-docs-markdown-wrap">
                <article className="api-docs-content api-docs-overview-content">
                <section id="glkb-api" className="api-docs-overview-hero">
                    <div className="api-docs-overview-hero-card">
                        <div className="api-docs-overview-copy">
                            <h1>GLKB API</h1>
                            <p>
                                A researcher investigating 1,500 candidate genes cannot read 15,000
                                abstracts, but automating with a general LLM trades reliability for speed.
                                GLKB addresses both: send a list of genes, variants, or drug targets and
                                get back cited answers, grounded in 263M+ biomedical terms and live PubMed.
                            </p>
                            <div className="api-docs-overview-actions">
                                <button
                                    type="button"
                                    className="api-docs-pill-btn primary"
                                    onClick={() => navigate('/api-docs/quickstart')}
                                >
                                    Get Started
                                </button>
                                <button
                                    type="button"
                                    className="api-docs-pill-btn muted"
                                    onClick={() => navigate('/api-page')}
                                >
                                    Get API Key
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="api-docs-overview-stats" aria-label="Knowledge graph stats">
                        <article className="api-docs-overview-stat-card">
                            <div className="api-docs-overview-stat-copy">
                                <p>263M+</p>
                                <h3>Biomedical Terms</h3>
                            </div>
                            <img src={resolveImageAssetUrl(dnaIcon)} alt="Biomedical terms" className="api-docs-overview-stat-icon" />
                        </article>

                        <article className="api-docs-overview-stat-card">
                            <div className="api-docs-overview-stat-copy">
                                <p>14.6M+</p>
                                <h3>Relationships</h3>
                            </div>
                            <img src={resolveImageAssetUrl(relationIcon)} alt="Relationships" className="api-docs-overview-stat-icon" />
                        </article>
                    </div>
                </section>

                <div id="beyond-manual-review" className="api-docs-overview-anchor" aria-hidden="true" />

                <section id="why-glkb" className="api-docs-overview-section">
                    <h2>Why GLKB</h2>
                    <div className="api-docs-overview-why-grid">
                        {WHY_GLKB_ITEMS.map((item) => {
                            const Icon = item.icon;
                            return (
                                <article key={item.title} className="api-docs-overview-why-item">
                                    <h3>
                                        <span>{item.title}</span>
                                        <Icon
                                            className="api-docs-overview-why-icon"
                                            sx={{ fontSize: 20, color: 'var(--color-blue-500)' }}
                                        />
                                    </h3>
                                    <p>{item.body}</p>
                                </article>
                            );
                        })}
                    </div>
                </section>

                <section id="what-you-can-build" className="api-docs-overview-section">
                    <h2>What you can build</h2>
                    <div className="api-docs-overview-table">
                        <div className="api-docs-overview-table-row header">
                            <div>Workflow</div>
                            <div>What you send</div>
                            <div>What you get back</div>
                        </div>
                        {WORKFLOW_ROWS.map((row) => (
                            <div key={row.workflow} className="api-docs-overview-table-row">
                                <div>{row.workflow}</div>
                                <div>{row.input}</div>
                                <div>{row.output}</div>
                            </div>
                        ))}
                    </div>
                </section>

                <section id="knowledge-base" className="api-docs-overview-section">
                    <h2>Knowledge base</h2>
                    <p>
                        The GLKB knowledge graph is built from the full PubMed corpus and encodes
                        gene-disease associations, pathway memberships, co-occurrence statistics, and ontology
                        hierarchies across 263 million biomedical terms and 14.6 million relationships.
                    </p>
                </section>
                <div className="api-docs-overview-end-space" aria-hidden="true" />
                </article>
            </div>

            <aside className="api-docs-index-rail" aria-label="Overview navigator">
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

export default OverviewLanding;
