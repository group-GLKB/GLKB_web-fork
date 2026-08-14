/**
 * Blog content, from Figma 707:2703 (GLKB) and 732:8445 (Investigate).
 *
 * The prose lives here as structured blocks rather than markup so both posts
 * render through one component and the index page can read their metadata
 * without importing the articles themselves.
 *
 * Block kinds: h2 | h3 | p | figure | table | stats | callout | list | sample
 */
import glkb01 from '../../img/blog/glkb-01-two-kinds.png';
import glkb02 from '../../img/blog/glkb-02-funnel.png';
import glkb03 from '../../img/blog/glkb-03-schema.png';
import glkb04 from '../../img/blog/glkb-04-retrieval.png';
import glkb05 from '../../img/blog/glkb-05-rfx6.png';
import glkb06 from '../../img/blog/glkb-06-investigate.png';
import inv01 from '../../img/blog/inv-01-pipeline.png';
import inv02 from '../../img/blog/inv-02-architecture.png';
import inv03 from '../../img/blog/inv-03-retrieval.png';
import inv04 from '../../img/blog/inv-04-funnel.png';
import inv05 from '../../img/blog/inv-05-claim-centric.png';
import inv06 from '../../img/blog/inv-06-verification.png';
import inv07 from '../../img/blog/inv-07-report-anatomy.png';
import inv08 from '../../img/blog/inv-08-positioning.png';
import inv09 from '../../img/blog/inv-09-search-mode.png';

const glkbPost = {
    slug: 'glkb-knowledge-graph',
    kicker: "GLKB · KDD '26 paper article",
    date: 'Aug 11, 2026',
    title: 'GLKB: Turning 33 Million PubMed Abstracts Into a Graph You Can Query',
    lede: 'GLKB links the biomedical literature to nine curated repositories through a shared '
        + 'controlled vocabulary — so a question like “what has been published about RFX6 and '
        + 'beta-cell function” becomes a database query with provenance back to the sentence.',
    cta: { label: 'Try GLKB →', to: '/' },
    readNext: 'investigate-auditable-research',
    toc: [
        [{ id: 'at-a-glance', label: 'At a Glance' }],
        [
            { id: 'overview', label: 'Overview' },
            { id: 'the-gap', label: 'The Gap', child: true },
            { id: 'what-glkb-is', label: 'What GLKB Is', child: true },
        ],
        [
            { id: 'construction', label: 'Construction' },
            { id: 'how-it-was-built', label: 'How It Was Built', child: true },
            { id: 'the-graph', label: 'The Graph', child: true },
            { id: 'three-ways-in', label: 'Three Ways In', child: true },
        ],
        [
            { id: 'use-cases', label: 'Use Cases' },
            { id: 'grounding-llms', label: 'Grounding LLMs', child: true },
            { id: 'hypothesis-generation', label: 'Hypothesis Generation', child: true },
            { id: 'embeddings-for-ml', label: 'Embeddings for ML', child: true },
        ],
        [
            { id: 'downstream', label: 'Downstream' },
            { id: 'powering-investigate', label: 'Powering Investigate', child: true },
            { id: 'limitations', label: 'Limitations', child: true },
        ],
        [{ id: 'getting-access', label: 'Getting Access' }],
    ],
    blocks: [
        { kind: 'h2', id: 'at-a-glance', nav: 'At a Glance', text: 'At a Glance' },
        { kind: 'p', text: 'PubMed is the largest repository of biomedical knowledge in existence, and almost all of it is prose. Curated knowledge graphs are machine-readable but cover a tiny, hand-picked slice of what is known. Neither can answer a question that spans both.' },
        { kind: 'p', text: 'We built a construction pipeline that extracts entities and relationships from the literature and reconciles them against biomedical ontologies. The result is the Genomic Literature Knowledge Base (GLKB): 14,634,427 relationships between 3,276,336 biomedical terms, drawn from 33,403,054 PubMed abstracts and nine curated repositories, in one Neo4j property graph.' },
        { kind: 'p', text: 'It is machine-readable, provenance-carrying, and open. Grounding GPT-3.5 with GLKB raised PubMedQA accuracy from 0.62 to 0.76 and BioASQ from 0.80 to 0.88. Its term embeddings distinguish real PubMed statements from fabricated ones at AUROC 0.77, and from irrelevant ones at 0.99.' },
        {
            kind: 'table',
            head: ['Metric', 'Value'],
            rows: [
                ['PubMed abstracts processed', '33.4M'],
                ['Biomedical relationships', '14.6M'],
                ['Biomedical terms', '3.28M'],
                ['Curated repositories joined', '9'],
            ],
        },

        { kind: 'h2', id: 'overview', nav: 'Overview', text: 'Two Kinds of Biomedical Knowledge, and Nothing That Joins Them' },
        { kind: 'p', text: 'If you want to know whether a gene has been linked to a disease, you have two options, and they fail in opposite directions.' },
        { kind: 'p', text: 'You can query a curated knowledge graph — DisGeNET, Reactome, GO. These are precise, machine-readable, and built by domain experts. They are also small. Curation is expensive, so they cover the relationships someone decided were worth encoding, which is a narrow and lagging subset of what has actually been reported.' },
        { kind: 'p', text: 'Or you can search PubMed. Thirty-three million abstracts is far more knowledge than any curated resource holds, and it is current. But it is unstructured text. You cannot ask it for all genes reported to interact with RFX6, ranked by how much evidence exists. You can only ask for documents, then read them.' },
        { kind: 'p', text: 'The problem is not that the knowledge is missing. It is that the largest store of it has no structure, and the structured stores are not the largest.' },
        { kind: 'p', text: 'GLKB closes that gap by extracting entities and relationships from PubMed, normalizing them against the same ontologies the curated databases use, and loading both into one graph. Because the two halves share a vocabulary, a single query can cross from a curated gene–pathway edge to the literature evidence supporting a gene–disease claim, and land on the PMIDs.' },
        { kind: 'figure', src: glkb01, caption: 'GLKB’s three parts. The controlled vocabulary is not a convenience — it is the mechanism. Because extracted entities and curated records resolve to the same term identifiers, the literature half and the expert half become one traversable graph.' },

        { kind: 'h3', id: 'what-glkb-is', nav: 'What GLKB Is', text: 'What GLKB Is' },
        { kind: 'p', text: 'GLKB is a Neo4j property graph with three parts. A controlled vocabulary forms the backbone. A semantic network extracted from PubMed attaches to it on one side. A curated network from nine expert-maintained repositories attaches on the other.' },
        { kind: 'p', text: 'The controlled vocabulary is what makes the join possible, and it is deliberately two-tiered. Level one holds the terms that get mentioned in text — genes and gene products, diseases and phenotypes, chemicals and drugs, sequence variants, anatomical structures, MeSH terms. Level two holds affiliated ontologies that describe those terms rather than appearing alongside them: Gene Ontology terms and pathways. In total, 690,477 level-one terms and 41,311 level-two terms, with 375,537 ontology mappings resolving synonyms and cross-references between source ontologies.' },
        { kind: 'p', text: 'Only level-one terms are connected to articles. Level-two terms connect to level-one terms through the curated network. That separation avoids a large source of redundancy and keeps the literature-derived half of the graph interpretable.' },

        { kind: 'h2', id: 'construction', nav: 'How It Was Built', text: 'How It Was Built' },
        { kind: 'p', text: 'Extracting a knowledge graph from 33 million abstracts is mostly a precision problem. Named-entity recognition on biomedical text produces enormous recall and a long tail of confident nonsense — ER is endoplasmic reticulum, or estrogen receptor, or erdosteine, depending on a context the tagger often does not have. Left unfiltered, those errors become edges, and a graph of edges you cannot trust is worse than no graph.' },
        { kind: 'p', text: 'The construction pipeline — LiteralGraph in the paper — runs in four steps, and two of them exist purely to throw material away.' },
        { kind: 'h3', text: '1. Merge ontologies into a controlled vocabulary' },
        { kind: 'p', text: 'OBO Foundry ontologies are downloaded and deduplicated against reference datasets. Genes are aligned to NCBI Gene; chemicals and diseases are resolved against MeSH and UMLS. This resolved 7,846 duplicated chemical entries and 21,694 duplicated disease entries, and required only 128 manual gene alignments out of 43,794 entries.' },
        { kind: 'h3', text: '2. Recognize entities in every abstract' },
        { kind: 'p', text: 'Abstracts are sentence-split and coreference-resolved, then run through BERN2. Extracted mentions are normalized to the controlled vocabulary with Gilda, under a constraint that the mention and the term must share a type — so an ER tagged as an anatomical structure cannot resolve to a drug.' },
        { kind: 'h3', text: '3. Let an LLM audit the mappings, then delete the bad ones' },
        { kind: 'p', text: 'For each of the 95,219 high-frequency terms, 100 sampled entity–sentence pairs are judged by GPT-4. If more than five samples are wrong or uncertain, every mapping to that term is deleted. 20,049 terms were removed at this stage. This is the step that turns a noisy tagger into a usable vocabulary.' },
        { kind: 'h3', text: '4. Summarize relationships, not co-occurrences' },
        { kind: 'p', text: 'For each co-occurring term pair, sentences are reranked by a BGE model; up to 100 with normalized score ≥ 0.6 are summarized by GPT-4 into one of eight BioRED relationship types — positive correlation, negative correlation, association, binding, drug interaction, cotreatment, comparison, conversion. Pairs with no sentence supporting a direct relationship do not get an edge.' },
        { kind: 'p', text: 'The attrition is the interesting part. Of 432 million raw entity mentions, 60% survive to become graph annotations. Of 19.4 million term pairs that co-occur at least five times, fewer than half turn out to have any sentence actually asserting a relationship between them.' },
        { kind: 'figure', src: glkb02, caption: 'The construction funnel. Roughly 40% of raw entity mentions never become graph annotations, and more than half of frequently co-occurring term pairs never become edges. Both are deliberate: co-occurrence is not a relationship, and a tagger’s confidence is not evidence.' },
        {
            kind: 'callout',
            title: 'Why this matters if you use the graph',
            text: 'An edge in GLKB’s semantic network means at least one PubMed sentence asserts this relationship, and a model classified the assertion into a type. It does not mean the relationship is true, replicated, or uncontested. The graph carries the evidence so you can check — the Cooccur edge stores the supporting article count, and every extracted relationship traces back to the articles it was summarized from.',
        },

        { kind: 'h2', id: 'the-graph', nav: 'The Graph', text: 'What Is Actually in the Graph' },
        { kind: 'p', text: 'GLKB is a property graph, not a triple store, which means edges carry attributes and queries can filter on them. There are twelve node labels and eighteen relationship types.' },
        { kind: 'p', text: 'Every biomedical entity carries one shared Vocabulary label, subtyped by a single question: does the term appear in the text, or does it describe something that appears? Only the first kind is connected to articles. That split is what keeps the literature-derived half of the graph interpretable, and it is the reason a pathway never accumulates millions of spurious article edges.' },
        {
            kind: 'table',
            head: ['Category', 'Node types'],
            rows: [
                ['Mentioned in text (link to articles)', 'Gene, DiseaseOrPhenotypicFeature, ChemicalEntity, SequenceVariant, MeshTerm, AnatomicalEntity'],
                ['Descriptive (link only to other terms)', 'Pathway, BiologicalProcess, CellularComponent, MolecularFunction'],
                ['Bibliographic (the document layer)', 'Article, Journal'],
            ],
        },
        { kind: 'figure', src: glkb03, caption: 'The schema. The source property on every association edge is what lets you separate expert-curated claims from literature-extracted ones inside a single query — and the Cooccur edge, weighted by supporting article count, is what makes statistical association testing possible directly on the graph.' },
        {
            kind: 'table',
            head: ['Component', 'Scale', 'What it gives you'],
            rows: [
                ['PubMed articles', '33,403,054', 'Title, abstract, authors, journal, date, citation count, DOI — plus an embedding per abstract'],
                ['Sentence embeddings', '108,536,203', 'Background, Results and Conclusion sentences, embedded for passage-level retrieval'],
                ['Level-1 vocabulary', '690,477', 'The terms that appear in text and link to articles'],
                ['Level-2 vocabulary', '41,311', 'GO terms and pathways that describe level-1 terms'],
                ['Ontology mappings', '375,537', 'Synonym and cross-reference resolution across source ontologies'],
                ['Literature relationships', '14,634,427', 'Typed, evidence-backed edges between 3,276,336 terms'],
                ['Curated relationships', '3,795,248', 'Expert-maintained edges over 56,930 terms from nine repositories'],
                ['Term embeddings', '87,624', '1536-dim graph embeddings for genes, chemicals and diseases'],
            ],
        },

        { kind: 'h2', id: 'three-ways-in', nav: 'Three Ways In', text: 'Three Ways to Retrieve From It' },
        { kind: 'p', text: 'The same graph supports three retrieval modalities, and which one you want depends on how well-formed your question is.' },
        { kind: 'figure', src: glkb04, caption: 'The three retrieval modes are complementary, not alternatives. A well-built agent uses all three: textual to resolve what you named, semantic to find what you did not, structural to ask questions that involve more than one entity at a time.' },
        { kind: 'p', text: 'All three are reachable from a web interface with interactive graph visualization, from RESTful APIs, and — for the embeddings — as a downloadable data dump you can load into any model.' },

        { kind: 'h2', id: 'use-cases', nav: 'Use Cases', text: 'Use Cases' },
        { kind: 'h3', id: 'grounding-llms', nav: 'Grounding LLMs', text: '1. Grounding Language Models' },
        { kind: 'p', text: 'Language models fail in biomedicine in two specific ways: they fabricate plausible findings, and their knowledge is frozen at training time. Both are retrieval problems, and a graph that stores literature with provenance is a good place to retrieve from.' },
        { kind: 'p', text: 'We tested GPT-3.5-turbo with and without GLKB context, zero-shot, on two standard benchmarks. On PubMedQA — 500 questions derived from real abstracts — GLKB retrieved the source abstract as the top result for all 500 questions by cosine similarity.' },
        {
            kind: 'table',
            head: ['Benchmark', 'Metric', 'GPT-3.5-turbo alone', '+ GLKB context'],
            rows: [
                ['PubMedQA', 'Accuracy', '0.62', '0.76'],
                ['PubMedQA', 'F1', '0.44', '0.54'],
                ['BioASQ', 'Accuracy', '0.80', '0.88'],
                ['BioASQ', 'F1', '0.70', '0.78'],
            ],
        },
        { kind: 'p', text: 'The PubMedQA gain — 0.62 to 0.76 — puts a small 2023-era model near reported human performance on that benchmark, purely by giving it the right paragraph. That is the whole argument for retrieval over scale in this domain: the knowledge already exists in the literature, and the model’s job is to read it correctly rather than to remember it.' },
        { kind: 'h3', text: 'The QA Agent' },
        { kind: 'p', text: 'The paper standardizes this into a four-component agent. A planner decomposes a question into steps. A semantic retriever pulls detailed knowledge from articles using the multi-level indexes. A graph retriever queries the curated repositories for structured associations the text search would miss. An answer generator synthesizes across subqueries and attaches references.' },
        { kind: 'p', text: 'That architecture is the direct ancestor of Investigate, which took the same decomposition and hardened every stage into something auditable.' },

        { kind: 'h3', id: 'hypothesis-generation', nav: 'Hypothesis Generation', text: '2. Hypothesis Generation From Your Own Data' },
        { kind: 'p', text: 'This is the use case most bench scientists will recognize. You have a differential-expression list with a few thousand genes on it. Somewhere in that list are the genes that matter, and finding them means reading a great deal of literature you do not have time to read.' },
        { kind: 'p', text: 'RFX6 had recently been identified as a hub gene for beta-cell function, but its relationship to other type 2 diabetes genes was unclear. Here is what the graph query looks like end to end.' },
        { kind: 'figure', src: glkb05, caption: 'The RFX6 workflow. Two chi-square screens against literature co-occurrence reduce ~9,700 differentially expressed genes to 72 candidates. As an unprompted check, 19 of the 36 curated T2D causal genes from the Type 2 Diabetes Knowledge Portal fall inside that set.' },
        { kind: 'p', text: 'The result that makes this more than a filtering exercise is the negative one. Of the 17 T2D causal genes that did not come out of the RFX6 screen, 15 also sit far from RFX6 in the co-occurrence clustering — which is a specific, falsifiable statement: RFX6 acts through insulin secretion and beta-cell development, and not through the other established T2D mechanisms.' },
        {
            kind: 'callout',
            title: 'What this is and is not',
            text: 'Co-occurrence in the literature is not evidence of shared biological function, and the paper says so directly — only two of the functional groups were statistically significant under DBSCAN. This is a hypothesis-narrowing tool. It turns "read 2,675 genes’ worth of literature" into "look closely at these 72, in these four groups," which is a different and much more tractable task.',
        },

        { kind: 'h3', id: 'embeddings-for-ml', nav: 'Embeddings for ML', text: '3. Literature as a Feature for ML' },
        { kind: 'p', text: 'Semantic knowledge in PubMed is normally unusable by machine-learning models because it is prose. GLKB makes it usable by representing it as a graph and then embedding the graph: a two-layer Heterogeneous Graph Transformer trained on co-occurrence link prediction, producing 1536-dimensional vectors for 87,624 genes, chemicals and diseases.' },
        { kind: 'p', text: 'Two validations, both designed to test whether these vectors carry real biology rather than lexical similarity.' },
        { kind: 'h3', text: 'Do They Predict Curated Relationships?' },
        { kind: 'p', text: 'Logistic regression on the embeddings predicts six kinds of relationship from the curated network — gene regulatory networks, ligand–receptor pairs, gene–disease associations and others — with good AUROC across all of them. The literature-derived vectors recover relationships that were established independently, by experts, using different evidence.' },
        { kind: 'h3', text: 'Can They Tell a Real Finding From a Fabricated One?' },
        { kind: 'p', text: 'The sharper test. Take 1,246 real PubMed sentences and score their cosine similarity to the relevant term embeddings, against two negative sets: randomly sampled PubMed sentences, and fabricated sentences generated by GPT-3.5-turbo containing incorrect knowledge.' },
        {
            kind: 'table',
            head: ['Comparison', 'AUROC'],
            rows: [
                ['vs. irrelevant sentences', '0.99'],
                ['vs. fabricated sentences', '0.77'],
            ],
        },
        { kind: 'p', text: 'Both outperform BlueBERT on the same task.' },
        { kind: 'p', text: 'Separating real statements from irrelevant ones at 0.99 shows the embeddings capture topic. Separating real statements from plausible-but-wrong ones at 0.77 is the harder and more useful result: it means the vectors encode something about which specific claims the literature actually supports, not merely what the literature is about.' },

        { kind: 'h2', id: 'downstream', nav: 'Powering Investigate', text: 'What the Graph Makes Possible Downstream' },
        { kind: 'p', text: 'GLKB is infrastructure, and the clearest way to see what infrastructure is worth is to look at what gets built on it. Investigate, our deep-research agent, uses the graph in four distinct places — and none of them would exist without it.' },
        { kind: 'figure', src: glkb06, caption: 'Investigate treats GLKB as four capabilities at once. The graph walk is the one with no substitute: it reaches mechanism papers that share no keywords with the question, by following curated relationships between the entities involved.' },
        { kind: 'p', text: 'The last row is the one we did not anticipate. Because GLKB holds expert-curated edges alongside literature-extracted ones, an agent can check the relations it pulled out of a paper against relations that were independently curated. The knowledge base becomes not just the source but the auditor.' },

        { kind: 'h2', id: 'limitations', nav: 'Limitations', text: 'Limitations Worth Stating Plainly' },
        {
            kind: 'list',
            items: [
                ['An edge is an assertion, not a fact.', 'The semantic network says a sentence somewhere claims a relationship and a model typed it. Replication, effect size, and contradiction live in the articles, which is why the PMIDs matter more than the edges.'],
                ['Coverage is abstracts, not full text.', 'Most quantitative results — the effect sizes, the confidence intervals, the caveats — live in Results sections and figure captions that the extraction pipeline does not see.'],
                ['Extraction errors survive at a rate.', 'The LLM audit removed 20,049 terms, but it audits terms, not individual mappings. Rare terms below the frequency threshold were never sampled.'],
                ['Updates are annual,', 'tracking the PubMed annual release. For fast-moving questions, pair the graph with a live PubMed query — which is exactly what the retrieval stack downstream does.'],
            ],
        },
        { kind: 'p', text: 'The right mental model: GLKB is a map of what the literature says, with a route back to every source. It is not a substitute for reading the sources.' },

        { kind: 'h2', id: 'getting-access', nav: 'Getting Access', text: 'Getting Access' },
        { kind: 'p', text: 'GLKB is open and reachable three ways: a web interface with interactive graph visualization for exploratory work; RESTful APIs for programmatic retrieval at scale; and a data dump of the semantic embeddings for loading into your own models.' },
        { kind: 'p', text: 'The construction framework matters as much as the artifact, which is why the paper names it separately. LiteralGraph is modular and described entirely in JSON configuration — every input dataset and model is a config entry, so updating one component means editing a file and rerunning one module. It follows a BioCypher schema and the FAIR principles, which is a deliberate bet that the same pipeline should build knowledge graphs for domains other than genomics.' },
        {
            kind: 'callout',
            title: 'If you take one thing from this',
            text: 'The bottleneck in biomedical AI is not model capability. Grounding a 2023-era model with the right paragraph moved PubMedQA from 0.62 to 0.76 — a gain no amount of prompting produces. The bottleneck is that the knowledge is not addressable. Making 33 million abstracts queryable, with provenance intact, is the part that had to be built.',
        },
    ],
};

const investigatePost = {
    slug: 'investigate-auditable-research',
    kicker: 'GLKB · product article',
    date: 'Aug 11, 2026',
    title: 'GLKB Investigate: Literature Research You Can Audit Line by Line',
    lede: 'Investigate reads the literature the way a careful reviewer does — searching six ways '
        + 'at once, quoting papers verbatim, putting contradictory studies side by side, and '
        + 're-checking every conclusion against its own evidence before you ever see it.',
    cta: { label: 'Try Investigate →', to: '/' },
    cardTitle: 'How Investigate turns this graph into an auditable research report',
    readNext: 'glkb-knowledge-graph',
    toc: [
        [{ id: 'at-a-glance', label: 'At a Glance' }],
        [
            { id: 'three-failures', label: 'Three Failures' },
            { id: 'confidently-wrong', label: 'Confidently Wrong', child: true },
            { id: 'silently-incomplete', label: 'Silently Incomplete', child: true },
            { id: 'blandly-averaged', label: 'Blandly Averaged', child: true },
        ],
        [
            { id: 'six-phases', label: 'Six Phases' },
            { id: 'full-architecture', label: 'Full Architecture', child: true },
            { id: 'six-searches', label: 'Six Searches', child: true },
            { id: 'the-funnel', label: 'The Funnel', child: true },
            { id: 'group-by-claim', label: 'Group by Claim', child: true },
            { id: 'five-gates', label: 'Five Gates', child: true },
            { id: 'the-report', label: 'The Report', child: true },
        ],
        [
            { id: 'the-proof', label: 'The Proof' },
            { id: 'sample-run', label: 'Sample Run', child: true },
            { id: 'how-it-compares', label: 'How It Compares', child: true },
        ],
        [{ id: 'search-mode', label: 'Search Mode' }],
        [
            { id: 'guarantees', label: 'Guarantees' },
            { id: 'grounded-by-construction', label: 'Grounded by Construction', child: true },
            { id: 'recall-first', label: 'Recall-First by Design', child: true },
            { id: 'real-graph', label: 'Built on a Real Graph', child: true },
        ],
    ],
    blocks: [
        { kind: 'h2', id: 'at-a-glance', nav: 'At a Glance', text: 'At a Glance' },
        { kind: 'p', text: 'Investigate reads the literature the way a careful reviewer does — searching six ways at once, quoting papers verbatim, putting contradictory studies side by side, and re-checking every conclusion against its own evidence before you ever see it.' },
        {
            kind: 'table',
            head: ['Metric', 'Value'],
            rows: [
                ['Papers screened → papers cited, on one real question', '3,604 → 33'],
                ['Recall of the decisive papers (vs. 0.547 for single-search retrieval)', '0.891'],
                ['Fabricated citations across the evaluation set', '0'],
                ['Time for a full six-section report with figures and provenance', '~7 min'],
            ],
        },

        { kind: 'h2', id: 'three-failures', nav: 'Three Failures', text: 'Three Failures That Make Literature AI Unusable for Real Research' },
        { kind: 'p', text: 'Not because the writing is bad. Because the writing is good, and you cannot tell which parts are true.' },
        {
            kind: 'list',
            items: [
                ['Confidently wrong.', 'An invented effect size reads exactly like a real one. In a grant or a manuscript, that is not an inconvenience — it is a career event.'],
                ['Silently incomplete.', 'One search returns one neighbourhood of the literature. The trial that settles your question is titled empagliflozin, not SGLT2 inhibitors.'],
                ['Blandly averaged.', 'Studies disagree constantly, and that disagreement is the finding. A tool that smooths it into consensus has destroyed the information you needed.'],
            ],
        },
        { kind: 'p', text: 'Investigate is built around one commitment: every sentence in the report is traceable to a sentence in a paper, and the system checks that itself before it hands you anything.' },

        { kind: 'h2', id: 'six-phases', nav: 'Six Phases', text: 'Six Phases, One Question' },
        { kind: 'p', text: 'Investigate is a fixed pipeline, not an agent improvising. Every run does the same things in the same order — which is what makes the output comparable, reproducible, and possible to audit.' },
        { kind: 'figure', src: inv01, caption: 'The pipeline. Deterministic code does the work that must be reproducible — retrieval fusion, claim grouping, citation checking. Models are used where judgement is genuinely required, and the expensive one only three times.' },

        { kind: 'h3', id: 'full-architecture', nav: 'Full Architecture', text: 'The Same Thing, at Full Resolution' },
        { kind: 'p', text: 'For readers who want the system diagram rather than the story: every module, every data path, and where each one sits on the cost/determinism spectrum.' },
        { kind: 'figure', src: inv02, caption: 'Full system architecture. Note the shape of the compute allocation: the frontier model appears in exactly three places (planning, ranking, synthesis) plus one escalation path, while every step whose job is to constrain the output — fusion, the verbatim check, claim projection, the citation guard, the structural checklist, the polish rollback — is deterministic code. That asymmetry is the design.' },

        { kind: 'h2', id: 'six-searches', nav: 'Six Searches', text: 'Because One Search Is One Point of Failure' },
        { kind: 'figure', src: inv03, caption: 'Six retrieval channels feeding one pool. Fusion is round-robin, not score-truncation — so the paper that only one specific probe ever found still makes it through. After ranking, a deterministic safety net re-inserts a first-hand paper for every drug, trial or assay your question named, so the ranker cannot quietly drop one.' },
        { kind: 'p', text: 'The knowledge-graph channel is the one competitors cannot copy: it walks 14.6M literature-derived relationships to reach mechanism papers that share no keywords with your question.' },

        { kind: 'h2', id: 'the-funnel', nav: 'The Funnel', text: 'You See the Whole Funnel, Not Just the Answer' },
        { kind: 'p', text: 'Every run reports what it found, what it screened, what actually yielded evidence, and what it cited — the same accounting a systematic review is expected to publish.' },
        { kind: 'figure', src: inv04, caption: 'The paper funnel from a real Investigate run. Every number is emitted by the pipeline itself — you can check the arithmetic of your own report.' },

        { kind: 'h2', id: 'group-by-claim', nav: 'Group by Claim', text: 'Disagreement Only Surfaces if You Group by Claim' },
        { kind: 'p', text: 'Summarise paper by paper and four studies that contradict each other become four correct paragraphs in four different places. Investigate makes the claim the unit and the paper an attribute — so opposing results end up inside the same object and collide.' },
        { kind: 'figure', src: inv05 },
        { kind: 'p', text: 'The grouping is done in plain code, with no model call. That matters: a model cannot decide an inconvenient contradiction is unimportant, because by the time any model sees the material, both sides are already inside the same object. A “disagreement” where both sides cite the same paper is rejected automatically.' },

        { kind: 'h2', id: 'five-gates', nav: 'Five Gates', text: 'Five Gates, Every One of Them Fails Closed' },
        { kind: 'p', text: 'Asking a model to cite its sources is a prompt. This is a pipeline. Three of the five gates are ordinary code — they cannot be talked into approving their own output.' },
        { kind: 'figure', src: inv06, caption: 'Claims fall through five sieves. When a conclusion cannot be cleared, the report does not quietly drop it — it opens with a plain-language note that the evidence is insufficient or conflicting, and still shows you the best-supported synthesis and its sources.' },

        { kind: 'h2', id: 'the-report', nav: 'The Report', text: 'A Report, Not a Paragraph' },
        { kind: 'p', text: 'The sections are computed evidence-first and then reordered for reading. Your bottom line is written last, from the judgment — so it is derived from the evidence rather than asserted and then justified.' },
        { kind: 'figure', src: inv07, caption: 'Writing order versus reading order. Producing the direct answer fourth, from the finished judgment, is what stops the report from picking a conclusion and then shopping for support.' },

        { kind: 'h2', id: 'the-proof', nav: 'Sample Run', text: 'What It Actually Looks Like' },
        { kind: 'p', text: 'Excerpts from an unedited run on a genuinely hard methods question — bridging statistical association to biological mechanism in in silico cell models.' },
        {
            kind: 'sample',
            label: 'SAMPLE OUTPUT — INVESTIGATE · RUN 436S · 33 PAPERS CITED',
            note: 'The system flagged this itself. It is the faithfulness gate refusing to let a clean-looking answer stand on evidence that did not fully support it.',
            sections: [
                {
                    heading: 'Direct answer',
                    body: 'Current evidence supports the integration of fine-mapping-informed linking and probabilistic approaches as the most effective strategies for bridging statistical association to biological mechanisms in cell modeling. This approach appears to yield more directly testable gene hypotheses and better accommodates the complexities of allelic heterogeneity compared to strict GWAS–QTL colocalization. However, the role of regulatory network propagation remains uncertain, as it lacks the causal anchoring necessary for robust gene prioritization.',
                },
                {
                    heading: 'Evidence analysis — quoted, with numbers',
                    body: 'In evaluations of evidence-integration for gene mapping, FABIO was reported to reduce causal gene set size by 27.9%–36.9% versus existing approaches across traits; in simulations, FABIO also showed lower average false inclusion, with 0.22 false genes per 95% credible set for FABIO vs 0.35 for FOCUS. PMID 39621803',
                },
                {
                    heading: null,
                    body: 'In analyses of colocalization that model multiple signals, non-primary eQTL signals accounted for 17% of all colocalizations, and conditional signal isolation prior to coloc yielded 37% more colocalizations than using marginal data. The most plausible reading is that accounting for secondary signals recovers biologically relevant overlaps that single-signal colocalization systematically misses. PMID 39606410, PMID 39711576',
                },
                {
                    heading: 'Conflict analysis — the part nothing else does',
                    body: 'Whether strict GWAS–eQTL colocalization should be treated as the primary linkage criterion:',
                },
                {
                    heading: null,
                    body: 'Side A: eQTL resources and statistical colocalization are valuable for mapping GWAS loci to candidate causal genes. PMID 35643189',
                },
                {
                    heading: null,
                    body: 'Side B: Large-scale integration results show that relying on strict colocalization alone can miss biologically relevant links. PMID 39173627',
                },
                {
                    heading: null,
                    body: 'Source of disagreement: Side A emphasises colocalization\'s utility as a mapping tool; Side B emphasises the practical limits of treating it as the sole gate for gene nomination.',
                },
                {
                    heading: null,
                    body: '→ Better supported: Side B — consistent with the judgment that moving beyond strict GWAS–QTL colocalization is often necessary in practice, with strict colocalization better viewed as a high-specificity subset within broader integration.',
                },
            ],
            footer: 'retrieved 3,604 · screened in 55 · yielded evidence 48 · cited 33 · run time 436 s · figures embedded from PMC 2',
        },
        { kind: 'p', text: 'Notice what the system was willing to say: the evidence was insufficient, one method family is weaker than the others, and three separate disagreements remain unresolved. That is what a colleague tells you. It is not what a demo tells you.' },

        { kind: 'h2', id: 'how-it-compares', nav: 'How It Compares', text: 'Depth Is Common. Auditability Is Not.' },
        { kind: 'p', text: 'Plenty of tools will read a lot of papers for you. The question a researcher actually has to answer is whether they can defend the output in a lab meeting.' },
        { kind: 'figure', src: inv08, caption: 'Categories, not vendors. The top-right quadrant requires two things at once: retrieval that unions many independent channels, and verification that runs as code rather than as instructions to a model.' },
        {
            kind: 'table',
            head: ['What researchers ask', 'What Investigate does about it'],
            rows: [
                ['“Did it miss the paper that contradicts me?”', 'Six independent retrieval channels, a second feedback round, and a rule that every drug, trial or assay named in the question keeps a first-hand paper in the final set.'],
                ['“Is this number real?”', 'Every quote is verified as a literal substring of the source before it can be cited, and each citation carries its source sentence and the section it came from.'],
                ['“What does the field actually disagree about?”', 'A dedicated conflict section where the two sides must cite different papers and the write-up must name the source of disagreement — species, assay, threshold, population, sample size.'],
                ['“Can I trust the confidence?”', 'Every conclusion is inference-checked against its own cited evidence. Failures are surfaced at the top of the report, not hidden.'],
                ['“Can I reproduce this?”', 'A fixed pipeline, a published paper funnel, and a stated cost and runtime per report.'],
            ],
        },

        { kind: 'h2', id: 'search-mode', nav: 'Search Mode', text: 'Search Mode, for When You Already Know What You Want' },
        { kind: 'p', text: 'Investigate is for open questions and takes minutes. Search Mode answers a scoped ask in seconds, with two independent dials over the corpus.' },
        { kind: 'figure', src: inv09, caption: 'The two dials are independent, so they compose: reviews + high impact to orient in a new field, primary + recent to see what was actually observed this year. “Reviews only” is fail-closed — a primary study titled “Kinase inhibitors: an overview” is read and rejected rather than passed through on its title.' },

        { kind: 'h2', id: 'guarantees', nav: 'Guarantees', text: 'Every Sentence Traces Back to a Sentence in a Paper' },
        { kind: 'p', text: 'Investigate takes eight to fifteen minutes and costs a few tens of cents, because the alternative — an answer you have to verify yourself — costs an afternoon. You get a six-section report, a paper funnel you can audit, the verbatim source sentence behind every citation, an explicit account of what the field disagrees about, and an honest note when the evidence would not carry the conclusion.' },
        {
            kind: 'list',
            items: [
                ['Grounded by construction.', 'Papers are compressed to verbatim evidence before any reasoning happens. Nothing enters the report un-quoted.'],
                ['Recall-first by design.', 'Six channels, round-robin fusion and named-entity pinning, measured at 0.891 recall of decisive papers.'],
                ['Built on a real graph.', '33.4M PubMed abstracts and 14.6M relationships between 3.3M terms, used for retrieval, figures and fact cross-checking.'],
            ],
        },
    ],
};

export const posts = [investigatePost, glkbPost];

export const getPost = (slug) => posts.find((post) => post.slug === slug) || null;

export default posts;
