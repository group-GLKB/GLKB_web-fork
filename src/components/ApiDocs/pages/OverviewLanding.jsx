import React from 'react';

import {
  Biotech as BiotechIcon,
  DataObject as DataObjectIcon,
  OpenInFull as OpenInFullIcon,
  Security as SecurityIcon,
  Verified as VerifiedIcon,
} from '@mui/icons-material';

const WHY_GLKB_ITEMS = [
    {
        title: 'Scale',
        body: 'Process hundreds of genes, variants, or drug targets in parallel. 1,500 genes in ~30 minutes.',
        icon: OpenInFullIcon,
    },
    {
        title: 'Reliability',
        body: 'Every claim linked to a PubMed ID. Gaps labeled "none found," never fabricated.',
        icon: VerifiedIcon,
    },
    {
        title: 'Structured Output',
        body: 'Define a schema in your prompt. Unsupported fields are left empty, not guessed.',
        icon: DataObjectIcon,
    },
    {
        title: 'Reproducibility',
        body: 'Same Prompt + Same List -> Consistent, parseable output every time.',
        icon: SecurityIcon,
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

const OVERVIEW_CODE = `import requests, json, os

for line in requests.post(
    "https://api.glkb.dev/apps/glkb/users/me/batch",
    headers={"Authorization": f"Bearer {os.environ['GLKB_API_KEY']}"},
    json={"items": ["TP53", "KRAS", "BRCA1"],
          "prompt_template": "Role of {item} in cancer? 2 PMIDs.",
          "concurrency": 3},
    stream=True,
).iter_lines():
    if line.startswith(b"data:"):
        print(json.loads(line[5:]).get("response"))`;

const OverviewLanding = ({ navigate }) => {
    return (
        <div className="api-docs-overview-wrap">
            <div className="api-docs-overview-content">
                <section id="glkb-api" className="api-docs-overview-hero">
                    <div className="api-docs-overview-copy">
                        <h1>GLKB API</h1>
                        <p>
                            Run your first literature query in minutes. Send a list of genes, variants, or
                            drug targets. Get back cited answers, grounded in 263M+ biomedical terms and
                            live PubMed, streamed in real time.
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
                                onClick={() => navigate('/account')}
                            >
                                Get API Key
                            </button>
                        </div>
                    </div>
                    <div className="api-docs-overview-code-card" aria-label="Python example">
                        <div className="api-docs-overview-code-head">
                            <span>Python</span>
                            <button
                                type="button"
                                aria-label="Copy code"
                                className="api-docs-copy-btn"
                                onClick={() => navigator.clipboard?.writeText(OVERVIEW_CODE)}
                            >
                                <BiotechIcon sx={{ fontSize: 14 }} />
                            </button>
                        </div>
                        <pre>
                            <code>{OVERVIEW_CODE}</code>
                        </pre>
                    </div>
                </section>

                <section id="beyond-manual-review" className="api-docs-overview-section">
                    <h2>Beyond manual review</h2>
                    <p>
                        A researcher investigating 1,500 candidate genes cannot read 15,000 abstracts.
                        Automating with a general LLM trades reliability for speed: outputs lack citations,
                        hallucinate findings, and cannot be traced back to source evidence. The GLKB API
                        addresses both problems at once.
                    </p>
                </section>

                <section id="why-glkb" className="api-docs-overview-section">
                    <h2>Why GLKB</h2>
                    <div className="api-docs-overview-why-grid">
                        {WHY_GLKB_ITEMS.map((item) => {
                            const Icon = item.icon;
                            return (
                                <article key={item.title} className="api-docs-overview-why-item">
                                    <h3>
                                        <Icon sx={{ fontSize: 18 }} />
                                        <span>{item.title}</span>
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
            </div>

            <aside className="api-docs-overview-toc" aria-label="Page TOC">
                <a href="#glkb-api" className="active" aria-label="GLKB API section" />
                <a href="#beyond-manual-review" aria-label="Beyond manual review section" />
                <a href="#why-glkb" aria-label="Why GLKB section" />
                <a href="#what-you-can-build" aria-label="What you can build section" />
                <a href="#knowledge-base" aria-label="Knowledge base section" />
            </aside>
        </div>
    );
};

export default OverviewLanding;
