/**
 * The use-case tabs. The candidate-target example is from Figma 604:7446; the
 * other four are real GLKB chat answers (gpt-6.1-terra, 2026-11-04), condensed to
 * the claims their three kept references support, with quotes checked against
 * the abstracts.
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
            { type: 'paragraph', text: 'Moving from short-term in vivo models (often islet transplant systems) to\u00A0longer-term safety/efficacy\u00A0studies.' },
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
                pmid: '30581122',
                citations: 39,
            },
        ],
    },

    {
        id: 'variant-interpretation',
        label: 'Interpreting a Variant',
        lede: 'Bring together functional assays, cellular and animal models, penetrance estimates, and clinical cohorts to judge what a genetic variant does and how much it matters for patients.',
        question: 'What is the functional and clinical evidence for LRRK2 G2019S in Parkinson’s disease?',
        answer: [
            { type: 'paragraph', text: 'LRRK2 G2019S in Parkinson’s disease (PD): what’s known' },
            { type: 'paragraph', text: 'G2019S is a pathogenic, incompletely penetrant variant that can cause autosomal-dominant PD.' },
            { type: 'heading', text: '1) Functional evidence: a hyperactive kinase' },
            {
                type: 'list',
                items: [
                    'Kinase activation and Rab substrates G2019S increases LRRK2 kinase activity approximately two- to threefold, and LRRK2 directly phosphorylates a subset of Rab GTPases, altering their interactions with trafficking regulators 1.',
                    'Kinase-dependent neuronal defects G2019S impaired axonal autophagosome transport in mouse and gene-edited human iPSC-derived neurons; genetic or pharmacological LRRK2 inhibition reversed the transport defect 2.',
                ],
            },
            { type: 'heading', text: '2) Clinical evidence: penetrance and phenotype' },
            {
                type: 'list',
                items: [
                    'Age-dependent, incomplete penetrance In one research cohort, cumulative PD incidence in carriers reached 49% by age 80, a 10-fold risk versus non-carriers; higher polygenic risk was associated with greater penetrance 3.',
                    'A distinct non-motor profile The phenotype often resembles other PD, but carriers with PD in the same longitudinal cohort had a similar motor burden and reported less hyposmia, REM sleep behaviour disorder and cognitive difficulty 3.',
                ],
            },
            { type: 'heading', text: '3) Implications for interpretation' },
            { type: 'paragraph', text: 'Genetic evidence is strong, and kinase-dependent cellular defects provide a plausible route to neuronal injury; how that activity produces neurodegeneration in people remains less fully resolved. PD risk rises with age but is not deterministic.' },
        ],
        references: [
            {
                title: 'Phosphoproteomics reveals that Parkinson’s disease kinase LRRK2 regulates a subset of Rab GTPases.',
                meta: 'Martin Steger et al. · 2016 · Elife',
                quote: '“G2019S, the most common amino acid substitution activates the kinase two- to threefold. ... LRRK2 directly phosphorylates these both in vivo and in vitro ...”',
                pmid: '26824392',
                citations: 310,
            },
            {
                title: 'Increased LRRK2 kinase activity alters neuronal autophagy by disrupting the axonal transport of autophagosomes.',
                meta: 'C Alexander Boecker et al. · 2021 · Curr Biol',
                quote: '“We found that the most common LRRK2 mutation, LRRK2-G2019S, dramatically reduces the processivity of autophagosome transport in neurons in a kinase-dependent manner.”',
                pmid: '33765413',
                citations: 65,
            },
            {
                title: 'Genetic analysis and natural history of Parkinson’s disease due to the LRRK2 G2019S variant.',
                meta: 'Matthew J Kmiecik et al. · 2024 · Brain',
                quote: '“The cumulative incidence of PD in G2019S carriers by age 80 was 49%. G2019S carriers had a 10-fold risk of developing PD versus non-carriers.”',
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
        answer: [
            { type: 'paragraph', text: 'Metformin as an anticancer therapy: what the evidence shows' },
            { type: 'paragraph', text: 'Metformin has a plausible anticancer rationale, supported by laboratory experiments and observational associations. However, large randomized trials have not established an anticancer benefit in the populations tested.' },
            { type: 'heading', text: '1) Mechanistic rationale: tumor-cell metabolism' },
            { type: 'paragraph', text: 'Metformin can directly inhibit tumor-cell metabolism. In cancer cells and mouse models, it inhibited mitochondrial complex I and tumor growth; introducing a metformin-resistant alternative enzyme reversed those effects 1.' },
            { type: 'heading', text: '2) Clinical evidence: an observational signal, a null randomized trial' },
            {
                type: 'list',
                items: [
                    'Observational studies A meta-analysis of early-stage cancers estimated an overall-survival hazard ratio of 0.69 for colorectal cancer in metformin users versus nonusers, but all 27 included studies were observational 2.',
                    'Randomized evidence In the MA.32 trial, adding metformin to standard treatment did not improve invasive disease-free survival among 3,649 patients without diabetes who had high-risk early breast cancer; the HR was 1.01 in the hormone-receptor-positive primary analysis 3.',
                ],
            },
            { type: 'heading', text: '3) Implications and open questions' },
            { type: 'paragraph', text: 'Metformin remains a research candidate rather than an established anticancer therapy. The key gap is whether a defined tumor or patient subgroup can derive a clinically meaningful benefit that is reproducible in randomized trials.' },
        ],
        references: [
            {
                title: 'Metformin inhibits mitochondrial complex I of cancer cells to reduce tumorigenesis.',
                meta: 'William W Wheaton et al. · 2014 · Elife',
                quote: '“In vivo, the administration of metformin to mice inhibited the growth of control human cancer cells but not those expressing NDI1.”',
                pmid: '24843020',
                citations: 565,
            },
            {
                title: 'Metformin as an adjuvant treatment for cancer: a systematic review and meta-analysis.',
                meta: 'C Coyle et al. · 2016 · Ann Oncol',
                quote: '“...all enrolled in observational studies. In those with early-stage colorectal cancer, metformin use was associated with a significant benefit in all outcomes ...”',
                pmid: '27681864',
                citations: 200,
            },
            {
                title: 'Effect of Metformin vs Placebo on Invasive Disease-Free Survival in Patients With Breast Cancer: The MA.32 Randomized Clinical Trial.',
                meta: 'Pamela J Goodwin et al. · 2022 · JAMA',
                quote: '“The incidence rates for invasive disease-free survival events were 2.78 per 100 patient-years in the metformin group vs 2.74 per 100 patient-years in the placebo group ...”',
                pmid: '35608580',
                citations: 80,
            },
        ],
    },
    {
        id: 'mechanism-mapping',
        label: 'Mapping a Mechanism',
        lede: 'Trace a pathway from receptor signaling to cell state to tissue-level outcome, linking knockout models, intervention studies, and human data to see where the causal evidence is strongest.',
        question: 'How does TREM2 signaling shape the microglial response to amyloid in Alzheimer’s disease?',
        answer: [
            { type: 'paragraph', text: 'TREM2 and the microglial response to amyloid in Alzheimer’s disease (AD)' },
            { type: 'paragraph', text: 'TREM2 helps microglia recognize and respond to amyloid-β (Aβ), shifting them into a metabolically active, plaque-associated state. In mouse models, that response helps microglia contain plaques and limits damage to nearby neurites.' },
            { type: 'heading', text: '1) Signaling: TREM2–DAP12, SYK and PI3K–AKT–mTOR' },
            { type: 'paragraph', text: 'The TREM2–DAP12 complex signals through SYK and the PI3K–AKT–mTOR pathway, supporting the metabolism needed for a mature disease-associated microglial (DAM) state. A separate DAP10-dependent pathway supports an earlier, APOE-expressing state 1.' },
            { type: 'heading', text: '2) At the plaque: containment, not simple clearance' },
            {
                type: 'list',
                items: [
                    'Plaque compaction In 5XFAD mice lacking TREM2, plaques were less completely enclosed by microglia and more diffuse, even when early total Aβ accumulation was similar 2.',
                    'Neuritic protection Those poorly enclosed plaques were associated with more neuritic damage 2.',
                    'Sustained activation cuts both ways Chronic activation with a TREM2 antibody increased peri-plaque microglial activation but also increased nearby tau pathology and neuritic dystrophy, without changing plaque burden, in one amyloid mouse model 3.',
                ],
            },
            { type: 'heading', text: '3) Implications and caveats' },
            { type: 'paragraph', text: 'TREM2 enables microglia to gather around and reshape plaques, not simply remove amyloid, but the response is not uniformly protective in every context. Plaque containment and the consequences of sustained activation need to be distinguished; the causal mechanism is best established in experimental models.' },
        ],
        references: [
            {
                title: 'TREM2 drives microglia response to amyloid-β via SYK-dependent and -independent pathways.',
                meta: 'Shoutang Wang et al. · 2022 · Cell',
                quote: '“...the TREM2-DAP12 receptor complex that transmits intracellular signals through the protein tyrosine kinase SYK. ... SYK deficiency impaired the PI3K-AKT-GSK-3β-mTOR pathway ...”',
                pmid: '36306735',
                citations: 106,
            },
            {
                title: 'TREM2-mediated early microglial response limits diffusion and toxicity of amyloid plaques.',
                meta: 'Yaming Wang et al. · 2016 · J Exp Med',
                quote: '“...in the absence of TREM2, Aβ plaques were not fully enclosed by microglia; they were more diffuse, less dense, and were associated with significantly greater neuritic damage.”',
                pmid: '27091843',
                citations: 231,
            },
            {
                title: 'Chronic TREM2 activation exacerbates Aβ-associated tau seeding and spreading.',
                meta: 'Nimansha Jain et al. · 2023 · J Exp Med',
                quote: '“...chronic administration of an activating TREM2 antibody increases peri-plaque microglial activation but surprisingly increases peri-plaque NP-tau pathology and neuritic dystrophy ...”',
                pmid: '36219197',
                citations: 47,
            },
        ],
    },
    {
        id: 'biomarkers',
        label: 'Finding Biomarkers',
        lede: 'Survey candidate biomarkers across protein, nucleic-acid, and other classes, comparing reported sensitivity, specificity, and study design to separate promising leads from markers ready for clinical use.',
        question: 'What circulating biomarkers have been studied for early detection of pancreatic cancer?',
        answer: [
            { type: 'paragraph', text: 'Circulating biomarkers for early detection of pancreatic cancer' },
            { type: 'paragraph', text: 'Studied markers include CA19-9 and other circulating proteins, cell-free DNA methylation and microRNAs. Most work concerns pancreatic ductal adenocarcinoma (PDAC), and the newer markers remain investigational for screening.' },
            { type: 'heading', text: '1) The anchor marker: CA19-9' },
            { type: 'paragraph', text: 'CA19-9 is the best-established blood marker, but it misses some early cancers. In prediagnostic samples collected within six months of diagnosis, it detected 50% of cases subsequently diagnosed at an early stage, at 99% specificity 1.' },
            { type: 'heading', text: '2) Newer candidates, usually tested alongside CA19-9' },
            {
                type: 'list',
                items: [
                    'Cell-free DNA methylation plus proteins In a validation set of 40 early-stage cases and 40 matched healthy controls, CA19-9, TIMP1 and a nine-locus methylation panel achieved an AUC of 0.86, versus 0.82 for CA19-9 alone 2.',
                    'Circulating microRNAs Plasma miRNAs including miR-16 and miR-196a have been studied; a miRNA–CA19-9 panel identified 85.2% of stage I tumors in one case-control study 3.',
                ],
            },
            { type: 'heading', text: '3) Caveats for screening' },
            { type: 'paragraph', text: 'Performance estimates from case-control comparisons, particularly against healthy controls, should not be assumed to predict performance in an asymptomatic screening population.' },
        ],
        references: [
            {
                title: 'Lead-Time Trajectory of CA19-9 as an Anchor Marker for Pancreatic Cancer Early Detection.',
                meta: 'Johannes F Fahrmann et al. · 2021 · Gastroenterology',
                quote: '“...sensitivities reaching 60% at 99% specificity within 0 to 6 months before diagnosis for all cases and 50% at 99% specificity for cases diagnosed with early-stage disease.”',
                pmid: '33333055',
                citations: 4,
            },
            {
                title: 'Protein biomarkers and alternatively methylated cell-free DNA detect early stage pancreatic cancer.',
                meta: 'Roni Ben-Ami et al. · 2024 · Gut',
                quote: '“...a combined panel including CA19-9, TIMP1 and a 9-loci cfDNA methylation panel had greater discrimination (AUC 0.86, 95% CI 0.77 to 0.95) than CA19-9 alone ...”',
                pmid: '38123998',
                citations: 9,
            },
            {
                title: 'Combination of plasma microRNAs with serum CA19-9 for early detection of pancreatic cancer.',
                meta: 'Jianqiang Liu et al. · 2012 · Int J Cancer',
                quote: '“Most significantly, the combination was effective at identification of tumors in Stage 1 (85.2%).”',
                pmid: '21913185',
                citations: 152,
            },
        ],
    },
];

export default USE_CASES;
