/**
 * The use-case tabs, from Figma 604:7445.
 *
 * The frame specifies four tabs but works only one of them through: the sample
 * answer, and the references beside it, exist for Drug Target Investigation
 * alone. The other three carry no copy in the design, so they carry none here.
 */
export const USE_CASES = [
    {
        id: 'drug-target',
        label: 'Drug Target Investigation',
        lede: 'Assess candidate targets by mechanism, human genetic evidence, known modulators, '
            + 'and clinical stage. Cited and ranked, without manual review.',
        question: 'What is the evidence for DYRK1A as a therapeutic target for Type 2 diabetes?',
        answer: [
            'Summary: why DYRK1A is considered a (β‑cell–regenerative) therapeutic target in T2D',
            'The core rationale is that pharmacologic inhibition of DYRK1A can unlock adult human β‑cell cycle entry, increasing β‑cell replication markers and—at least in preclinical xenograft models—increasing actual human β‑cell mass and improving/reversing hyperglycemia. Foundational work identified harmine (a DYRK1A inhibitor) as a human β‑cell mitogen and linked the effect to NFAT signaling 25751815. A second line of work using 5‑iodotubercidin (5‑IT) supported DYRK-family inhibition as a strategy to increase human β‑cell proliferation 26953159. More recent studies refine the target biology (DYRK1A and DYRK1B both matter) and show synergy with GLP‑1 receptor agonism in vivo 31821176, 38985854',
            '',
            'Mechanism / MoA (what DYRK1A inhibition is doing)',
            '1) Human β‑cell proliferation / regeneration',
            '• Harmine analogs were identified as human β‑cell mitogenic compounds 25751815',
            '• DYRK1A was proposed as the key target and NFAT transcription factors as mediators of the proliferative program 25751815',
            '• Independently, 5‑IT was shown to “strongly and selectively” increase human β‑cell proliferation in vitro and in vivo, with kinome profiling pointing to DYRK/CLK family inhibition; and the β‑cell proliferation effect was suppressed by FK506, consistent with a calcineurin–NFAT axis 26953159',
            '2) Target refinement: DYRK1A is central, but DYRK1B may be required for maximal effect',
            '• A combined pharmacologic + genetic approach “confirms that DYRK1A is a central target” 31821176',
            '• The same study reports “inhibition of both DYRK1A and DYRK1B is required for induction of maximal rates of human β cell proliferation” 31821176',
            '3) In vivo functional effect in human islet xenografts + GLP‑1 synergy',
            '• In mice with human islet grafts, a DYRK1A inhibitor + exendin‑4 (GLP‑1RA) increased actual human β‑cell mass “four- to sevenfold… and reverses diabetes” 38985854, with mechanisms including “enhanced human β cell proliferation, function, and survival” 38985854',
            'Translational point: the most compelling efficacy evidence is still preclinical, but it is in a human-tissue-in-vivo setting.',
            'Human genetic evidence (how strong is it?)',
            'What’s strong',
            'Directional genetic validation is substantial, but largely from dosage/LoF syndromes and model systems rather than common T2D GWAS hits.',
            '• In mice, lowering gene dosage supports the idea that DYRK1A is a β‑cell mass regulator: “changes in Dyrk1a gene dosage in mice strongly modulate glycaemia and circulating insulin levels” and haploinsufficiency caused “severe glucose intolerance, reduced beta cell mass and decreased beta cell proliferation” 24477974',
            'What’s limited / not yet compelling',
            '• Direct human common-variant (GWAS) evidence for DYRK1A in T2D risk is not clearly established from the evidence retrieved here. In the GLKB graph, DYRK1A→T2D shows up as literature co-occurrence rather than a curated genetic association.',
            '• There are human syndromes involving DYRK1A dosage (e.g., haploinsufficiency syndromes; trisomy 21 increases DYRK1A dosage), but linking those cleanly to T2D protection/risk is complex and may be confounded by broader syndrome physiology.',
            'If you want, I can run a focused PubMed/GWAS Catalog-style query in GLKB specifically for DYRK1A AND “genome-wide association” AND “type 2 diabetes” and summarize whether any reproducible human loci implicate the gene.',
            'Known inhibitors used as tool compounds (and where they stand)',
            'Widely used DYRK1A tool inhibitors in the diabetes β‑cell literature',
            '• Harmine (natural product; also known for other activities such as MAO inhibition): identified as a lead human β‑cell mitogen, with DYRK1A as “likely target” 25751815',
            '• 5‑iodotubercidin (5‑IT): increased human β‑cell proliferation and mapped by kinome profiling to DYRK/CLK inhibition 26953159',
            'More “drug-discovery” oriented DYRK1A inhibitor series (preclinical)',
            'Multiple medicinal chemistry programs exist (harmine analogs; other scaffolds), but none are established as approved antidiabetic drugs based on the evidence set above. (Several DYRK1A inhibitor chemotypes are being developed more broadly in neuro/oncology; diabetes efforts focus on β‑cell selectivity and safety.)',
        ],
        // The design repeats one reference three times and fills its quote with
        // lorem ipsum, so the quote is left out rather than shipped as filler.
        references: [
            {
                title: 'A high-throughput chemical screen reveals that harmine-mediated inhibition of DYRK1A increases human pancreatic beta cell replication',
                meta: 'Peng Wang et al. · 2015 · Nat Med',
                pmid: '25751815',
                citations: 188,
            },
            {
                title: 'A high-throughput chemical screen reveals that harmine-mediated inhibition of DYRK1A increases human pancreatic beta cell replication',
                meta: 'Peng Wang et al. · 2015 · Nat Med',
                pmid: '25751815',
                citations: 188,
            },
            {
                title: 'A high-throughput chemical screen reveals that harmine-mediated inhibition of DYRK1A increases human pancreatic beta cell replication',
                meta: 'Peng Wang et al. · 2015 · Nat Med',
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
