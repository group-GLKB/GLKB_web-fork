---
slug: glkb-knowledge-graph
kicker: GLKB · KDD '26 paper article
date: Aug 11, 2026
cta: [Try GLKB →](/)
readNext: investigate-auditable-research
toc:
  - [At a Glance](#at-a-glance)
  - [Overview](#overview)
    - [The Gap](#the-gap)
    - [What GLKB Is](#what-glkb-is)
  - [Construction](#construction)
    - [How It Was Built](#how-it-was-built)
    - [The Graph](#the-graph)
    - [Three Ways In](#three-ways-in)
  - [Use Cases](#use-cases)
    - [Grounding LLMs](#grounding-llms)
    - [Hypothesis Generation](#hypothesis-generation)
    - [Embeddings for ML](#embeddings-for-ml)
  - [Downstream](#downstream)
    - [Powering Investigate](#powering-investigate)
    - [Limitations](#limitations)
  - [Getting Access](#getting-access)
---

# GLKB: Turning 33 Million PubMed Abstracts Into a Graph You Can Query

GLKB links the biomedical literature to nine curated repositories through a shared controlled vocabulary — so a question like “what has been published about RFX6 and beta-cell function” becomes a database query with provenance back to the sentence.

## At a Glance {#at-a-glance}

PubMed is the largest repository of biomedical knowledge in existence, and almost all of it is prose. Curated knowledge graphs are machine-readable but cover a tiny, hand-picked slice of what is known. Neither can answer a question that spans both.

We built a construction pipeline that extracts entities and relationships from the literature and reconciles them against biomedical ontologies. The result is the Genomic Literature Knowledge Base (GLKB): 14,634,427 relationships between 3,276,336 biomedical terms, drawn from 33,403,054 PubMed abstracts and nine curated repositories, in one Neo4j property graph.

It is machine-readable, provenance-carrying, and open. Grounding GPT-3.5 with GLKB raised PubMedQA accuracy from 0.62 to 0.76 and BioASQ from 0.80 to 0.88. Its term embeddings distinguish real PubMed statements from fabricated ones at AUROC 0.77, and from irrelevant ones at 0.99.

| Metric | Value |
| --- | --- |
| PubMed abstracts processed | 33.4M |
| Biomedical relationships | 14.6M |
| Biomedical terms | 3.28M |
| Curated repositories joined | 9 |

## Two Kinds of Biomedical Knowledge, and Nothing That Joins Them {#overview}

If you want to know whether a gene has been linked to a disease, you have two options, and they fail in opposite directions.

You can query a curated knowledge graph — DisGeNET, Reactome, GO. These are precise, machine-readable, and built by domain experts. They are also small. Curation is expensive, so they cover the relationships someone decided were worth encoding, which is a narrow and lagging subset of what has actually been reported.

Or you can search PubMed. Thirty-three million abstracts is far more knowledge than any curated resource holds, and it is current. But it is unstructured text. You cannot ask it for all genes reported to interact with RFX6, ranked by how much evidence exists. You can only ask for documents, then read them.

The problem is not that the knowledge is missing. It is that the largest store of it has no structure, and the structured stores are not the largest.

GLKB closes that gap by extracting entities and relationships from PubMed, normalizing them against the same ontologies the curated databases use, and loading both into one graph. Because the two halves share a vocabulary, a single query can cross from a curated gene–pathway edge to the literature evidence supporting a gene–disease claim, and land on the PMIDs.

![GLKB’s three parts. The controlled vocabulary is not a convenience — it is the mechanism. Because extracted entities and curated records resolve to the same term identifiers, the literature half and the expert half become one traversable graph.](glkb-01-two-kinds.png)

### What GLKB Is {#what-glkb-is}

GLKB is a Neo4j property graph with three parts. A controlled vocabulary forms the backbone. A semantic network extracted from PubMed attaches to it on one side. A curated network from nine expert-maintained repositories attaches on the other.

The controlled vocabulary is what makes the join possible, and it is deliberately two-tiered. Level one holds the terms that get mentioned in text — genes and gene products, diseases and phenotypes, chemicals and drugs, sequence variants, anatomical structures, MeSH terms. Level two holds affiliated ontologies that describe those terms rather than appearing alongside them: Gene Ontology terms and pathways. In total, 690,477 level-one terms and 41,311 level-two terms, with 375,537 ontology mappings resolving synonyms and cross-references between source ontologies.

Only level-one terms are connected to articles. Level-two terms connect to level-one terms through the curated network. That separation avoids a large source of redundancy and keeps the literature-derived half of the graph interpretable.

## How It Was Built {#construction}

Extracting a knowledge graph from 33 million abstracts is mostly a precision problem. Named-entity recognition on biomedical text produces enormous recall and a long tail of confident nonsense — ER is endoplasmic reticulum, or estrogen receptor, or erdosteine, depending on a context the tagger often does not have. Left unfiltered, those errors become edges, and a graph of edges you cannot trust is worse than no graph.

The construction pipeline — LiteralGraph in the paper — runs in four steps, and two of them exist purely to throw material away.

### 1. Merge ontologies into a controlled vocabulary

OBO Foundry ontologies are downloaded and deduplicated against reference datasets. Genes are aligned to NCBI Gene; chemicals and diseases are resolved against MeSH and UMLS. This resolved 7,846 duplicated chemical entries and 21,694 duplicated disease entries, and required only 128 manual gene alignments out of 43,794 entries.

### 2. Recognize entities in every abstract

Abstracts are sentence-split and coreference-resolved, then run through BERN2. Extracted mentions are normalized to the controlled vocabulary with Gilda, under a constraint that the mention and the term must share a type — so an ER tagged as an anatomical structure cannot resolve to a drug.

### 3. Let an LLM audit the mappings, then delete the bad ones

For each of the 95,219 high-frequency terms, 100 sampled entity–sentence pairs are judged by GPT-4. If more than five samples are wrong or uncertain, every mapping to that term is deleted. 20,049 terms were removed at this stage. This is the step that turns a noisy tagger into a usable vocabulary.

### 4. Summarize relationships, not co-occurrences

For each co-occurring term pair, sentences are reranked by a BGE model; up to 100 with normalized score ≥ 0.6 are summarized by GPT-4 into one of eight BioRED relationship types — positive correlation, negative correlation, association, binding, drug interaction, cotreatment, comparison, conversion. Pairs with no sentence supporting a direct relationship do not get an edge.

The attrition is the interesting part. Of 432 million raw entity mentions, 60% survive to become graph annotations. Of 19.4 million term pairs that co-occur at least five times, fewer than half turn out to have any sentence actually asserting a relationship between them.

![The construction funnel. Roughly 40% of raw entity mentions never become graph annotations, and more than half of frequently co-occurring term pairs never become edges. Both are deliberate: co-occurrence is not a relationship, and a tagger’s confidence is not evidence.](glkb-02-funnel.png)

:::callout Why this matters if you use the graph
An edge in GLKB’s semantic network means at least one PubMed sentence asserts this relationship, and a model classified the assertion into a type. It does not mean the relationship is true, replicated, or uncontested. The graph carries the evidence so you can check — the Cooccur edge stores the supporting article count, and every extracted relationship traces back to the articles it was summarized from.
:::

## What Is Actually in the Graph {#the-graph}

GLKB is a property graph, not a triple store, which means edges carry attributes and queries can filter on them. There are twelve node labels and eighteen relationship types.

Every biomedical entity carries one shared Vocabulary label, subtyped by a single question: does the term appear in the text, or does it describe something that appears? Only the first kind is connected to articles. That split is what keeps the literature-derived half of the graph interpretable, and it is the reason a pathway never accumulates millions of spurious article edges.

| Category | Node types |
| --- | --- |
| Mentioned in text (link to articles) | Gene, DiseaseOrPhenotypicFeature, ChemicalEntity, SequenceVariant, MeshTerm, AnatomicalEntity |
| Descriptive (link only to other terms) | Pathway, BiologicalProcess, CellularComponent, MolecularFunction |
| Bibliographic (the document layer) | Article, Journal |

![The schema. The source property on every association edge is what lets you separate expert-curated claims from literature-extracted ones inside a single query — and the Cooccur edge, weighted by supporting article count, is what makes statistical association testing possible directly on the graph.](glkb-03-schema.png)

| Component | Scale | What it gives you |
| --- | --- | --- |
| PubMed articles | 33,403,054 | Title, abstract, authors, journal, date, citation count, DOI — plus an embedding per abstract |
| Sentence embeddings | 108,536,203 | Background, Results and Conclusion sentences, embedded for passage-level retrieval |
| Level-1 vocabulary | 690,477 | The terms that appear in text and link to articles |
| Level-2 vocabulary | 41,311 | GO terms and pathways that describe level-1 terms |
| Ontology mappings | 375,537 | Synonym and cross-reference resolution across source ontologies |
| Literature relationships | 14,634,427 | Typed, evidence-backed edges between 3,276,336 terms |
| Curated relationships | 3,795,248 | Expert-maintained edges over 56,930 terms from nine repositories |
| Term embeddings | 87,624 | 1536-dim graph embeddings for genes, chemicals and diseases |

## Three Ways to Retrieve From It {#three-ways-in}

The same graph supports three retrieval modalities, and which one you want depends on how well-formed your question is.

![The three retrieval modes are complementary, not alternatives. A well-built agent uses all three: textual to resolve what you named, semantic to find what you did not, structural to ask questions that involve more than one entity at a time.](glkb-04-retrieval.png)

All three are reachable from a web interface with interactive graph visualization, from RESTful APIs, and — for the embeddings — as a downloadable data dump you can load into any model.

## Use Cases {#use-cases}

### 1. Grounding Language Models {#grounding-llms}

Language models fail in biomedicine in two specific ways: they fabricate plausible findings, and their knowledge is frozen at training time. Both are retrieval problems, and a graph that stores literature with provenance is a good place to retrieve from.

We tested GPT-3.5-turbo with and without GLKB context, zero-shot, on two standard benchmarks. On PubMedQA — 500 questions derived from real abstracts — GLKB retrieved the source abstract as the top result for all 500 questions by cosine similarity.

| Benchmark | Metric | GPT-3.5-turbo alone | + GLKB context |
| --- | --- | --- | --- |
| PubMedQA | Accuracy | 0.62 | 0.76 |
| PubMedQA | F1 | 0.44 | 0.54 |
| BioASQ | Accuracy | 0.80 | 0.88 |
| BioASQ | F1 | 0.70 | 0.78 |

The PubMedQA gain — 0.62 to 0.76 — puts a small 2023-era model near reported human performance on that benchmark, purely by giving it the right paragraph. That is the whole argument for retrieval over scale in this domain: the knowledge already exists in the literature, and the model’s job is to read it correctly rather than to remember it.

### The QA Agent

The paper standardizes this into a four-component agent. A planner decomposes a question into steps. A semantic retriever pulls detailed knowledge from articles using the multi-level indexes. A graph retriever queries the curated repositories for structured associations the text search would miss. An answer generator synthesizes across subqueries and attaches references.

That architecture is the direct ancestor of Investigate, which took the same decomposition and hardened every stage into something auditable.

### 2. Hypothesis Generation From Your Own Data {#hypothesis-generation}

This is the use case most bench scientists will recognize. You have a differential-expression list with a few thousand genes on it. Somewhere in that list are the genes that matter, and finding them means reading a great deal of literature you do not have time to read.

RFX6 had recently been identified as a hub gene for beta-cell function, but its relationship to other type 2 diabetes genes was unclear. Here is what the graph query looks like end to end.

![The RFX6 workflow. Two chi-square screens against literature co-occurrence reduce ~9,700 differentially expressed genes to 72 candidates. As an unprompted check, 19 of the 36 curated T2D causal genes from the Type 2 Diabetes Knowledge Portal fall inside that set.](glkb-05-rfx6.png)

The result that makes this more than a filtering exercise is the negative one. Of the 17 T2D causal genes that did not come out of the RFX6 screen, 15 also sit far from RFX6 in the co-occurrence clustering — which is a specific, falsifiable statement: RFX6 acts through insulin secretion and beta-cell development, and not through the other established T2D mechanisms.

:::callout What this is and is not
Co-occurrence in the literature is not evidence of shared biological function, and the paper says so directly — only two of the functional groups were statistically significant under DBSCAN. This is a hypothesis-narrowing tool. It turns "read 2,675 genes’ worth of literature" into "look closely at these 72, in these four groups," which is a different and much more tractable task.
:::

### 3. Literature as a Feature for ML {#embeddings-for-ml}

Semantic knowledge in PubMed is normally unusable by machine-learning models because it is prose. GLKB makes it usable by representing it as a graph and then embedding the graph: a two-layer Heterogeneous Graph Transformer trained on co-occurrence link prediction, producing 1536-dimensional vectors for 87,624 genes, chemicals and diseases.

Two validations, both designed to test whether these vectors carry real biology rather than lexical similarity.

### Do They Predict Curated Relationships?

Logistic regression on the embeddings predicts six kinds of relationship from the curated network — gene regulatory networks, ligand–receptor pairs, gene–disease associations and others — with good AUROC across all of them. The literature-derived vectors recover relationships that were established independently, by experts, using different evidence.

### Can They Tell a Real Finding From a Fabricated One?

The sharper test. Take 1,246 real PubMed sentences and score their cosine similarity to the relevant term embeddings, against two negative sets: randomly sampled PubMed sentences, and fabricated sentences generated by GPT-3.5-turbo containing incorrect knowledge.

| Comparison | AUROC |
| --- | --- |
| vs. irrelevant sentences | 0.99 |
| vs. fabricated sentences | 0.77 |

Both outperform BlueBERT on the same task.

Separating real statements from irrelevant ones at 0.99 shows the embeddings capture topic. Separating real statements from plausible-but-wrong ones at 0.77 is the harder and more useful result: it means the vectors encode something about which specific claims the literature actually supports, not merely what the literature is about.

## What the Graph Makes Possible Downstream {#downstream}

GLKB is infrastructure, and the clearest way to see what infrastructure is worth is to look at what gets built on it. Investigate, our deep-research agent, uses the graph in four distinct places — and none of them would exist without it.

![Investigate treats GLKB as four capabilities at once. The graph walk is the one with no substitute: it reaches mechanism papers that share no keywords with the question, by following curated relationships between the entities involved.](glkb-06-investigate.png)

The last row is the one we did not anticipate. Because GLKB holds expert-curated edges alongside literature-extracted ones, an agent can check the relations it pulled out of a paper against relations that were independently curated. The knowledge base becomes not just the source but the auditor.

## Limitations Worth Stating Plainly {#limitations}

- **An edge is an assertion, not a fact.** The semantic network says a sentence somewhere claims a relationship and a model typed it. Replication, effect size, and contradiction live in the articles, which is why the PMIDs matter more than the edges.
- **Coverage is abstracts, not full text.** Most quantitative results — the effect sizes, the confidence intervals, the caveats — live in Results sections and figure captions that the extraction pipeline does not see.
- **Extraction errors survive at a rate.** The LLM audit removed 20,049 terms, but it audits terms, not individual mappings. Rare terms below the frequency threshold were never sampled.
- **Updates are annual,** tracking the PubMed annual release. For fast-moving questions, pair the graph with a live PubMed query — which is exactly what the retrieval stack downstream does.

The right mental model: GLKB is a map of what the literature says, with a route back to every source. It is not a substitute for reading the sources.

## Getting Access {#getting-access}

GLKB is open and reachable three ways: a web interface with interactive graph visualization for exploratory work; RESTful APIs for programmatic retrieval at scale; and a data dump of the semantic embeddings for loading into your own models.

The construction framework matters as much as the artifact, which is why the paper names it separately. LiteralGraph is modular and described entirely in JSON configuration — every input dataset and model is a config entry, so updating one component means editing a file and rerunning one module. It follows a BioCypher schema and the FAIR principles, which is a deliberate bet that the same pipeline should build knowledge graphs for domains other than genomics.

:::callout If you take one thing from this
The bottleneck in biomedical AI is not model capability. Grounding a 2023-era model with the right paragraph moved PubMedQA from 0.62 to 0.76 — a gain no amount of prompting produces. The bottleneck is that the knowledge is not addressable. Making 33 million abstracts queryable, with provenance intact, is the part that had to be built.
:::
