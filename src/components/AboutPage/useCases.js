/**
 * The use-case tabs and the worked candidate-target example from Figma 604:7446.
 */
export const USE_CASES = [
    {
        id: 'candidate-target',
        label: 'Understanding a Candidate Target',
        lede: 'Connect mechanistic studies, human genetic evidence, pharmacological findings, and clinical development to understand the biological rationale for a candidate target.',
        question: 'What is known about DYRK1A as a therapeutic target in type 2 diabetes?',
        answer: [
            { type: 'paragraph', text: 'DYRK1A in type 2 diabetes (T2D): what’s known' },
            { type: 'heading', text: '1) Rationale: β-cell failure in T2D makes β-cell regeneration attractive' },
            { type: 'paragraph', text: 'A major therapeutic idea in T2D is to\u00A0increase functional pancreatic β-cell mass. Multiple groups have identified\u00A0DYRK1A inhibition\u00A0as a way to unlock adult human β-cell cell-cycle entry, a process that is normally very limited.' },
            { type: 'heading', text: '2) Key experimental evidence supporting DYRK1A as a target' },
            {
                type: 'list',
                items: [
                    'Harmine and DYRK1A/NFAT axis (foundational evidence)\u00A0A high-throughput screen identified harmine analogs as\u00A0human β-cell mitogens, and the study proposes\u00A0DYRK1A as the likely target\u00A0with\u00A0NFAT transcription factors as mediators, with in vivo models showing increased β-cell proliferation, increased islet mass, and improved glycemic control\u00A01.',
                    'More robust proliferation via combination strategies (DYRK1A + TGFβ/SMAD pathway inhibition)\u00A0DYRK1A inhibitors alone drive modest proliferation; combining DYRK1A inhibition with\u00A0TGFβ superfamily/SMAD pathway inhibition\u00A0yielded substantially higher adult human β-cell proliferation and increased β-cell numbers, while noting preservation of differentiated function, and including β cells from people with T2D\u00A03.',
                    'Synergy with existing T2D drug class (GLP-1 receptor agonists + DYRK1A inhibitors)\u00A0GLP-1R agonists don’t typically increase human β-cell proliferation, while DYRK1A inhibitors do but modestly and with limited β-cell specificity. Combining the two classes\u00A0synergistically increased human β-cell replication, increased β-cell numbers, and extended to improved insulin secretion and glycemic control in mouse transplantation models; effects were also seen in β cells from individuals with T2D\u00A04.',
                    'Small-molecule series consistent with DYRK1A being a key driver\u00A0Aminopyrazine compounds (described as acting via combined DYRK1A and GSK3B inhibition) stimulated robust proliferation in adult human islets and improved glycemic control in diabetic mice, with multiple lines of evidence pointing to Dyrk1a as the key target\u00A02.',
                ],
            },
            { type: 'paragraph', text: '3) What the GLKB knowledge graph shows (structured vs. literature co-mention)' },
            { type: 'paragraph', text: 'In GLKB,\u00A0there is no curated GeneToDiseaseAssociation edge\u00A0recorded between DYRK1A and T2D (i.e., not a genetics/causal association entry in the KG for this pair).' },
            { type: 'paragraph', text: 'But DYRK1A and “Diabetes Mellitus, Type 2”\u00A0co-occur in the literature\u00A0with\u00A014 articles\u00A0captured as co-mentions (GLKB Cooccur edge; source PubMed).' },
            { type: 'paragraph', text: '4) Therapeutic implications and main open challenges' },
            { type: 'paragraph', text: 'Most mature concept:\u00A0DYRK1A inhibition as a\u00A0β-cell regenerative strategy\u00A0(alone or in combinations).' },
            { type: 'paragraph', text: 'Key translational challenges repeatedly implied by the experimental literature:' },
            { type: 'paragraph', text: 'Achieving\u00A0β-cell specificity\u00A0(DYRK1A is broadly expressed; systemic inhibition raises off-target risk).' },
            { type: 'paragraph', text: 'Ensuring\u00A0durable function\u00A0and avoiding unwanted proliferation/dedifferentiation (some studies explicitly test for preserved β-cell differentiated function in combinations).' },
            { type: 'paragraph', text: 'Moving from short-term in vivo models (often islet transplant systems) to\u00A0longer-term safety/efficacy\u00A0studies.ng additional inhibitor series and any emerging early clinical programs, if present).' },
        ],
        references: [
            {
                title: 'A high-throughput chemical screen reveals that harmine-mediated inhibition of DYRK1A increases human pancreatic beta cell replication.',
                meta: 'Peng Wang et al. · 2015 · Nat Med',
                quote: '“Here, using a high-throughput small-molecule screen (HTS), we find that analogs of the small molecule harmine function as a new class of human beta cell mitogenic ...”',
                pmid: '25751815',
                citations: 188,
            },
            {
                title: 'Inhibition of DYRK1A and GSK3B induces human β-cell proliferation.',
                meta: 'Weijun Shen et al. · 2015 · Nat Commun',
                quote: '“Here we report aminopyrazine compounds that stimulate robust β-cell proliferation in adult primary islets, most likely as a result of combined inhibition of ...”',
                pmid: '26496802',
                citations: 75,
            },
            {
                title: 'Combined Inhibition of DYRK1A, SMAD, and Trithorax Pathways Synergizes to Induce Robust Replication in Adult Human Beta Cells.',
                meta: 'Peng Wang et al. · 2019\u00A0·\u00A0Cell Metab',
                quote: '“Here, we demonstrate that combined pharmacologic inhibition of DYRK1A and transforming growth factor beta superfamily (TGFβSF)/SMAD signaling generates...”',
                pmid: '25751815',
                citations: 188,
            },
        ],
    },
    { id: 'deg', label: 'DEG Annotation' },
    { id: 'gwas', label: 'GWAS Interpretation' },
    { id: 'prioritization', label: 'Gene Prioritization' },
];

export default USE_CASES;
