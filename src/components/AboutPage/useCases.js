/**
 * The use-case tabs, and the worked example the scroll story is built on.
 *
 * USE_CASES: each tab is an excerpt of GLKB's stored answer to one of the example questions
 * (glkb-backend app/resources/example_answers.json: the best of three GPT-6.1 Sol answers,
 * ranked blind by two judges, 2026-11-04). The excerpt is the answer's opening paragraphs and
 * bullets, verbatim; its citations are renumbered [n] by first appearance and its references
 * are exactly the papers it cites. Every quote is the passage the answer drew on, checked
 * against the paper's PubMed abstract or PMC full text. "Open the full answer" asks the same
 * question in the chat, where the backend replays the whole stored answer, free.
 *
 * DYRK1A_EXAMPLE: the candidate-target example the workflow and review scenes draw (a condensed
 * GPT-6.1 Terra answer, quotes checked against the abstracts). Kept apart so the tabs can change
 * without the scenes' claims and their citations drifting apart.
 */

export const DYRK1A_EXAMPLE = {
    question: 'What is known about DYRK1A as a therapeutic target in type 2 diabetes?',
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
            meta: 'Peng Wang et al. · 2019 · Cell Metab',
            quote: '“Here, we demonstrate that combined pharmacologic inhibition of DYRK1A and transforming growth factor beta superfamily (TGFβSF)/SMAD signaling generates...”',
            pmid: '30581122',
            citations: 39,
        },
        {
            title: 'GLP-1 receptor agonists synergize with DYRK1A inhibitors to potentiate functional human β cell regeneration.',
            meta: 'Courtney Ackeifi et al. · 2020 · Sci Transl Med',
            quote: '“Here, we provide evidence that combining any member of the GLP1R agonist class with any member of the DYRK1A inhibitor class induces a synergistic increase in human β cell replication ...”',
            pmid: '32051230',
            citations: 47,
        },
    ],
};

export const USE_CASES = [
    {
        id: 'candidate-target',
        label: 'Understanding a Candidate Target',
        lede: 'Connect mechanistic studies, human genetic evidence, pharmacological findings, and clinical development to understand the biological rationale for a candidate target.',
        question: 'What is known about DYRK1A as a therapeutic target in type 2 diabetes?',
        // How many papers the whole answer cites; the excerpt shows the ones it reaches.
        sourceCount: 5,
        answer: [
            { type: 'paragraph', text: 'DYRK1A is a promising **β-cell regeneration** target for type 2 diabetes: inhibiting it can make adult human β cells re-enter the cell cycle, including cells from donors with type 2 diabetes. The evidence is compelling in human islets and mouse transplantation models, but does not yet establish clinical benefit in patients [1].' },
            { type: 'paragraph', text: 'DYRK1A inhibition releases a brake on β-cell proliferation. Harmine and other inhibitors act through calcineurin–NFAT-associated signaling; blocking calcineurin suppresses their proliferative effect. Multiple chemical scaffolds reproduce the response, supporting DYRK1A as a target rather than harmine alone as an unusual mitogen [2]. Nevertheless, DYRK1A inhibitors alone generally produce modest proliferation-labeling indices of approximately 1.5–3% [3].' },
        ],
        references: [
            {
                title: 'GLP-1 receptor agonists synergize with DYRK1A inhibitors to potentiate functional human β cell regeneration.',
                meta: 'Courtney Ackeifi et al. · 2020 · Sci Transl Med',
                quote: '“These beneficial effects on proliferation were seen in both normal human β cells and β cells derived from individuals with type 2 diabetes. The ability of the GLP1R agonist-DYRK1A inhibitor combination to …”',
                pmid: '32051230',
                citations: 47,
            },
            {
                title: 'Inhibition of DYRK1A Stimulates Human β-Cell Proliferation.',
                meta: 'Ercument Dirice et al. · 2016 · Diabetes',
                quote: '“Induction of β-cell proliferation by either 5-IT or harmine, another natural product DYRK1A inhibitor, was suppressed by coincubation with the calcineurin inhibitor FK506, suggesting involvement of DYRK1A and …”',
                pmid: '26953159',
                citations: 110,
            },
            {
                title: 'Combined Inhibition of DYRK1A, SMAD, and Trithorax Pathways Synergizes to Induce Robust Replication in Adult Human Beta Cells.',
                meta: 'Peng Wang et al. · 2019 · Cell Metab',
                quote: '“Small-molecule inhibitors of dual-specificity tyrosine-regulated kinase 1A (DYRK1A) induce human beta cells to proliferate, generating a labeling index of 1.5%-3%”',
                pmid: '30581122',
                citations: 39,
            },
        ],
    },
    {
        id: 'variant-interpretation',
        label: 'Interpreting a Variant',
        lede: 'Bring together functional assays, cellular and animal models, penetrance estimates, and clinical cohorts to judge what a genetic variant does and how much it matters for patients.',
        question: 'What is the evidence for LRRK2 G2019S in Parkinson’s disease?',
        // How many papers the whole answer cites; the excerpt shows the ones it reaches.
        sourceCount: 9,
        answer: [
            { type: 'paragraph', text: 'LRRK2 G2019S is an **established pathogenic variant** for Parkinson’s disease (PD), supported by human genetics and functional experiments—not merely a statistical risk association. It causes autosomal-dominant PD with incomplete, age-dependent penetrance: carrying it does not make disease inevitable [1][2].' },
            {
                type: 'list',
                items: [
                    'Human genetic evidence spans familial and apparently sporadic PD. G2019S was identified in 4 of 61 unrelated autosomal-dominant PD families from Italy, Portugal and Brazil, and independently in 8 of 482 patients with idiopathic PD. These findings established its relevance beyond a single pedigree or population [3][4].',
                    'Disease risk is substantial, but penetrance estimates depend on the population and ascertainment. Risk by age 80 was estimated at 26% (95% CI 18–36%) in an Ashkenazi Jewish kin-cohort analysis, versus 49% in a large online longitudinal cohort containing 1,286 carriers. The latter estimated approximately tenfold higher PD risk than in noncarriers; these estimates should not be treated as a universal individual probability [2][5].',
                ],
            },
        ],
        references: [
            {
                title: 'LRRK2 in Parkinson disease: challenges of clinical trials.',
                meta: 'Eduardo Tolosa et al. · 2020 · Nat Rev Neurol',
                quote: '“LRRK2 mutations, and particularly the most common mutation Gly2019Ser, are observed in patients with autosomal dominant PD and in those with apparent sporadic PD, who are clinically indistinguishable from …”',
                pmid: '31980808',
                citations: 197,
            },
            {
                title: 'Age-specific penetrance of LRRK2 G2019S in the Michael J. Fox Ashkenazi Jewish LRRK2 Consortium.',
                meta: 'Karen Marder et al. · 2015 · Neurology',
                quote: '“Estimates of the penetrance of LRRK2 G2019S vary widely (24%-100%), reflective of differences in ascertainment, age, sex, ethnic group, and genetic and environmental modifiers”',
                pmid: '26062626',
                citations: 55,
            },
            {
                title: 'A frequent LRRK2 gene mutation associated with autosomal dominant Parkinson\'s disease.',
                meta: 'Alessio Di Fonzo et al. · 2005 · Lancet',
                quote: '“We amplified and sequenced the coding region of LRRK2 from genomic DNA by PCR, and identified a heterozygous mutation (Gly2019 ser) present in four of 61 (6.6%) unrelated families with Parkinson\'s disease and …”',
                pmid: '15680456',
                citations: 131,
            },
            {
                title: 'A common LRRK2 mutation in idiopathic Parkinson\'s disease.',
                meta: 'William P Gilks et al. · 2005 · Lancet',
                quote: '“We assessed 482 patients with the disorder, of whom 263 had pathologically confirmed disease, by direct sequencing for mutations in exon 41 of LRRK2. The mutation was present in eight (1.6%) patients”',
                pmid: '15680457',
                citations: 254,
            },
            {
                title: 'Genetic analysis and natural history of Parkinson\'s disease due to the LRRK2 G2019S variant.',
                meta: 'Matthew J Kmiecik et al. · 2024 · Brain : a journal of neurology',
                quote: '“We performed a 3.5-year prospective longitudinal online study in a large number of 1286 genotyped LRRK2 G2019S carriers and 109 154 controls, with and without PD, recruited from the 23andMe Research Cohort”',
                pmid: '38804604',
                citations: 2,
            },
        ],
    },
    {
        id: 'drug-repurposing',
        label: 'Repurposing a Drug',
        lede: 'Weigh laboratory mechanisms, observational associations, and randomized trial results side by side to see whether a new indication for an approved drug holds up, and where the evidence falls short.',
        question: 'What evidence supports repurposing metformin as an anticancer therapy?',
        // How many papers the whole answer cites; the excerpt shows the ones it reaches.
        sourceCount: 7,
        answer: [
            { type: 'paragraph', text: 'Metformin has a credible biological rationale for repurposing, but **clinical efficacy remains unproven** as a general anticancer therapy. Preclinical activity and observational associations support the hypothesis; randomized treatment trials have largely failed to translate that promise into improved cancer outcomes.' },
            { type: 'paragraph', text: 'Metformin can interfere with both tumor metabolism and systemic growth signals. Proposed effects include AMPK activation and downstream mTOR inhibition, together with reductions in insulin-related and inflammatory signaling [1]. However, a major translational limitation is drug exposure: many experimental studies used concentrations 10–100 times higher than those achievable with standard diabetes treatment, weakening their relevance to conventional dosing [2].' },
            { type: 'paragraph', text: 'Observational survival associations are encouraging but do not establish an anticancer effect. Early reports suggested striking benefits, yet an analysis identified immortal-time, time-window and treatment-stage biases capable of producing apparent cancer-risk reductions of 20–94% [3]. More recent evidence is not uniformly negative: metformin use was associated with lower ovarian-cancer mortality among patients with diabetes after time-dependent analysis (adjusted HR 0.71, 95% CI 0.54–0.91), although the association was not significant across the full ovarian-cancer cohort [4]. This remains an association, not randomized evidence of treatment benefit.' },
        ],
        references: [
            {
                title: 'Metformin in cancer.',
                meta: 'Ritwika Mallik et al. · 2018 · Diabetes Res Clin Pract',
                quote: '“A potential anti-tumourigenic effect of metformin may be mediated by its role in activating AMP-kinase, which in turn inhibits mammalian target of rapamycin (mTOR). Non-AMPK dependent protective pathways may …”',
                pmid: '29807101',
                citations: 136,
            },
            {
                title: 'Metformin action: concentrations matter.',
                meta: 'Ling He et al. · 2015 · Cell Metab',
                quote: '“One key reason may be that almost all previous studies were conducted with supra-pharmacological concentrations (doses) of metformin, 10-100 times higher than maximally achievable therapeutic concentrations …”',
                pmid: '25651170',
                citations: 213,
            },
            {
                title: 'Metformin and the risk of cancer: time-related biases in observational studies.',
                meta: 'Samy Suissa et al. · 2012 · Diabetes Care',
                quote: '“These studies, subject to time-related biases that are avoidable with proper study design and data analysis, led to illusory extraordinarily significant effects, with reductions in cancer risk with metformin …”',
                pmid: '23173135',
                citations: 222,
            },
            {
                title: 'Metformin use and survival in people with ovarian cancer: A population-based cohort study from British Columbia, Canada.',
                meta: 'Paramdeep Kaur et al. · 2024 · Neoplasia (New York, N.Y.)',
                quote: '“Metformin use was associated with a 17 % better ovarian cancer survival in the full cohort (adjusted hazard ratio (aHR) = 0.83 (95 %CI 0.67, 1.02)), and a 16 % better ovarian cancer survival for serous cancers …”',
                pmid: '38972207',
                citations: 1,
            },
        ],
    },
    {
        id: 'mechanism-mapping',
        label: 'Mapping a Mechanism',
        lede: 'Trace a pathway from receptor signaling to cell state to tissue-level outcome, linking knockout models, intervention studies, and human data to see where the causal evidence is strongest.',
        question: 'How does TREM2 signaling shape the microglial response to amyloid?',
        // How many papers the whole answer cites; the excerpt shows the ones it reaches.
        sourceCount: 7,
        answer: [
            { type: 'paragraph', text: 'TREM2 couples amyloid-associated damage sensing to the metabolic and transcriptional changes that let microglia survive, cluster around plaques, and contain them. Its effect is therefore broader than Aβ clearance: it helps build a protective microglial barrier around amyloid deposits [1][2].' },
            { type: 'paragraph', text: 'TREM2 detects the lipid environment surrounding amyloid and injured neurons. It recognizes anionic and zwitterionic lipids associated with fibrillar Aβ and exposed on damaged neuronal membranes. The AD-risk R47H variant impairs this lipid sensing; TREM2 deficiency compromises microglial survival and clustering around plaques in amyloid-model mice [1].' },
            { type: 'paragraph', text: 'TREM2 signaling supplies the metabolic capacity needed for a sustained response. The TREM2–DAP12 complex activates SYK and downstream PI3K–AKT–GSK-3β–mTOR signaling, supporting the anabolic demands of disease-associated microglia (DAM). A parallel DAP10-dependent branch supports proliferation and an early Apoe-expressing state, but SYK is needed for the fuller DAM response and plaque encasement [3]. Consistent with this mechanism, supplying an alternative energy substrate restored plaque clustering and reduced adjacent neuronal dystrophy in TREM2-deficient mice [4].' },
        ],
        references: [
            {
                title: 'TREM2 lipid sensing sustains the microglial response in an Alzheimer\'s disease model.',
                meta: 'Yaming Wang et al. · 2015 · Cell',
                quote: '“Thus, TREM2 detects damage-associated lipid patterns associated with neurodegeneration, sustaining the microglial response to Aβ accumulation”',
                pmid: '25728668',
                citations: 845,
            },
            {
                title: 'TREM2 Haplodeficiency in Mice and Humans Impairs the Microglia Barrier Function Leading to Decreased Amyloid Compaction and Severe Axonal Dystrophy.',
                meta: 'Peng Yuan et al. · 2016 · Neuron',
                quote: '“Thus, TREM2 deficiency may disrupt the formation of a neuroprotective microglia barrier that regulates amyloid compaction and insulation”',
                pmid: '27196974',
                citations: 190,
            },
            {
                title: 'TREM2 drives microglia response to amyloid-β via SYK-dependent and -independent pathways.',
                meta: 'Shoutang Wang et al. · 2022 · Cell',
                quote: '“Microglia that adhere to Aβ plaques acquire a transcriptional signature, "disease-associated microglia" (DAM), which largely emanates from the TREM2-DAP12 receptor complex that transmits intracellular signals …”',
                pmid: '36306735',
                citations: 106,
            },
            {
                title: 'TREM2 Maintains Microglial Metabolic Fitness in Alzheimer\'s Disease.',
                meta: 'Tyler K Ulland et al. · 2017 · Cell',
                quote: '“Dietary cyclocreatine tempered autophagy, restored microglial clustering around plaques, and decreased plaque-adjacent neuronal dystrophy in TREM2-deficient mice with amyloid-β pathology”',
                pmid: '28802038',
                citations: 260,
            },
        ],
    },
    {
        id: 'biomarkers',
        label: 'Finding Biomarkers',
        lede: 'Survey candidate biomarkers across protein, nucleic-acid, and other classes, comparing reported sensitivity, specificity, and study design to separate promising leads from markers ready for clinical use.',
        question: 'Which circulating biomarkers detect pancreatic cancer early?',
        // How many papers the whole answer cites; the excerpt shows the ones it reaches.
        sourceCount: 6,
        answer: [
            { type: 'paragraph', text: 'CA19-9 is the main established circulating biomarker for pancreatic ductal adenocarcinoma (PDAC), but **it is not reliable for early screening**. The strongest investigational approaches combine CA19-9 with other proteins, cell-free DNA methylation, or circulating microRNAs; none should be confused with a validated population-screening test [1].' },
            {
                type: 'list',
                items: [
                    'CA19-9 alone misses cancers and produces false positives. Its utility for early diagnosis is limited, levels can rise with obstructive jaundice and other benign conditions, and Lewis-antigen-negative individuals may not produce it. CEA is less sensitive and is not a better stand-alone alternative [1].',
                    'Protein panels can improve detection over CA19-9 alone. Thrombospondin-2 (THBS2) plus CA19-9 achieved 87% sensitivity at 98% specificity in a 537-person validation study; THBS2 also discriminated stage I disease. Importantly, that 87% sensitivity was for PDAC overall, not specifically stage I [2].',
                    'Circulating DNA is more useful in combination than as a mutation-only assay. Plasma KRAS mutations were detectable in only 30% of 221 patients with resectable PDAC; adding four protein biomarkers increased sensitivity to 64%, with 99.5% specificity [3]. An alternative panel combining CA19-9, TIMP1 and pancreas-specific cfDNA methylation improved AUC from 0.82 to 0.86 in an independent validation set of 40 early-stage cases and 40 healthy controls—a modest improvement rather than near-perfect detection [4].',
                ],
            },
        ],
        references: [
            {
                title: 'A Quest for Survival: A Review of the Early Biomarkers of Pancreatic Cancer and the Most Effective Approaches at Present.',
                meta: 'Muhammad Begawan Bestari et al. · 2024 · Biomolecules',
                quote: '“Although CA19-9 can serve as a prognostic factor, its utility for early diagnosis and screening is limited. The ESMO clinical guidelines for PC explicitly state that CA19-9 is not effective as a screening tool”',
                pmid: '38540782',
                citations: 3,
            },
            {
                title: 'Detection of early pancreatic ductal adenocarcinoma with thrombospondin-2 and CA19-9 blood markers.',
                meta: 'Jungsun Kim et al. · 2017 · Sci Transl Med',
                quote: '“A phase 1 discovery study (n = 20), a phase 2a validation study (n = 189), and a second phase 2b validation study (n = 537) revealed that concentrations of plasma thrombospondin-2 (THBS2) discriminated among …”',
                pmid: '28701476',
                citations: 74,
            },
            {
                title: 'Combined circulating tumor DNA and protein biomarker-based liquid biopsy for the earlier detection of pancreatic cancers.',
                meta: 'Joshua D Cohen et al. · 2017 · Proc Natl Acad Sci U S A',
                quote: '“The cohort tested included 221 patients with resectable pancreatic ductal adenocarcinomas and 182 control patients without known cancer. KRAS mutations were detected in the plasma of 66 patients (30%), and …”',
                pmid: '28874546',
                citations: 263,
            },
            {
                title: 'Protein biomarkers and alternatively methylated cell-free DNA detect early stage pancreatic cancer.',
                meta: 'Roni Ben-Ami et al. · 2024 · Gut',
                quote: '“In the validation set of 40 early stage PDAC and 40 matched healthy controls, a combined panel including CA19-9, TIMP1 and a 9-loci cfDNA methylation panel had greater discrimination (AUC 0.86, 95% CI 0.77 to …”',
                pmid: '38123998',
                citations: 9,
            },
        ],
    },
];
