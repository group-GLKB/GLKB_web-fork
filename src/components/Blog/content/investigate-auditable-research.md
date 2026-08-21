---
slug: investigate-auditable-research
kicker: GLKB · product article
date: Aug 11, 2026
cta: [Try Investigate →](/)
cardTitle: How Investigate turns this graph into an auditable research report
readNext: glkb-knowledge-graph
toc:
  - [At a Glance](#at-a-glance)
  - [Three Failures](#three-failures)
    - [Confidently Wrong](#confidently-wrong)
    - [Silently Incomplete](#silently-incomplete)
    - [Blandly Averaged](#blandly-averaged)
  - [Six Phases](#six-phases)
    - [Full Architecture](#full-architecture)
    - [Six Searches](#six-searches)
    - [The Funnel](#the-funnel)
    - [Group by Claim](#group-by-claim)
    - [Five Gates](#five-gates)
    - [The Report](#the-report)
  - [The Proof](#the-proof)
    - [Sample Run](#sample-run)
    - [How It Compares](#how-it-compares)
  - [Search Mode](#search-mode)
  - [Guarantees](#guarantees)
    - [Grounded by Construction](#grounded-by-construction)
    - [Recall-First by Design](#recall-first)
    - [Built on a Real Graph](#real-graph)
---

# GLKB Investigate: Literature Research You Can Audit Line by Line

Investigate reads the literature the way a careful reviewer does — searching six ways at once, quoting papers verbatim, putting contradictory studies side by side, and re-checking every conclusion against its own evidence before you ever see it.

## At a Glance {#at-a-glance}

Investigate reads the literature the way a careful reviewer does — searching six ways at once, quoting papers verbatim, putting contradictory studies side by side, and re-checking every conclusion against its own evidence before you ever see it.

| Metric | Value |
| --- | --- |
| Papers screened → papers cited, on one real question | 3,604 → 33 |
| Recall of the decisive papers (vs. 0.547 for single-search retrieval) | 0.891 |
| Fabricated citations across the evaluation set | 0 |
| Time for a full six-section report with figures and provenance | ~7 min |

## Three Failures That Make Literature AI Unusable for Real Research {#three-failures}

Not because the writing is bad. Because the writing is good, and you cannot tell which parts are true.

- **Confidently wrong.** An invented effect size reads exactly like a real one. In a grant or a manuscript, that is not an inconvenience — it is a career event.
- **Silently incomplete.** One search returns one neighbourhood of the literature. The trial that settles your question is titled empagliflozin, not SGLT2 inhibitors.
- **Blandly averaged.** Studies disagree constantly, and that disagreement is the finding. A tool that smooths it into consensus has destroyed the information you needed.

Investigate is built around one commitment: every sentence in the report is traceable to a sentence in a paper, and the system checks that itself before it hands you anything.

## Six Phases, One Question {#six-phases}

Investigate is a fixed pipeline, not an agent improvising. Every run does the same things in the same order — which is what makes the output comparable, reproducible, and possible to audit.

![The pipeline. Deterministic code does the work that must be reproducible — retrieval fusion, claim grouping, citation checking. Models are used where judgement is genuinely required, and the expensive one only three times.](fig-01-pipeline.svg)

### The Same Thing, at Full Resolution {#full-architecture}

For readers who want the system diagram rather than the story: every module, every data path, and where each one sits on the cost/determinism spectrum.

![Full system architecture. Note the shape of the compute allocation: the frontier model appears in exactly three places (planning, ranking, synthesis) plus one escalation path, while every step whose job is to constrain the output — fusion, the verbatim check, claim projection, the citation guard, the structural checklist, the polish rollback — is deterministic code. That asymmetry is the design.](fig-02-architecture.svg)

## Because One Search Is One Point of Failure {#six-searches}

![Six retrieval channels feeding one pool. Fusion is round-robin, not score-truncation — so the paper that only one specific probe ever found still makes it through. After ranking, a deterministic safety net re-inserts a first-hand paper for every drug, trial or assay your question named, so the ranker cannot quietly drop one.](fig-03-retrieval.svg)

The knowledge-graph channel is the one competitors cannot copy: it walks 14.6M literature-derived relationships to reach mechanism papers that share no keywords with your question.

## You See the Whole Funnel, Not Just the Answer {#the-funnel}

Every run reports what it found, what it screened, what actually yielded evidence, and what it cited — the same accounting a systematic review is expected to publish.

![The paper funnel from a real Investigate run. Every number is emitted by the pipeline itself — you can check the arithmetic of your own report.](fig-04-funnel.svg)

## Disagreement Only Surfaces if You Group by Claim {#group-by-claim}

Summarise paper by paper and four studies that contradict each other become four correct paragraphs in four different places. Investigate makes the claim the unit and the paper an attribute — so opposing results end up inside the same object and collide.

![](fig-05-claim-centric.svg)

The grouping is done in plain code, with no model call. That matters: a model cannot decide an inconvenient contradiction is unimportant, because by the time any model sees the material, both sides are already inside the same object. A “disagreement” where both sides cite the same paper is rejected automatically.

## Five Gates, Every One of Them Fails Closed {#five-gates}

Asking a model to cite its sources is a prompt. This is a pipeline. Three of the five gates are ordinary code — they cannot be talked into approving their own output.

![Claims fall through five sieves. When a conclusion cannot be cleared, the report does not quietly drop it — it opens with a plain-language note that the evidence is insufficient or conflicting, and still shows you the best-supported synthesis and its sources.](fig-06-verification.svg)

## A Report, Not a Paragraph {#the-report}

The sections are computed evidence-first and then reordered for reading. Your bottom line is written last, from the judgment — so it is derived from the evidence rather than asserted and then justified.

![Writing order versus reading order. Producing the direct answer fourth, from the finished judgment, is what stops the report from picking a conclusion and then shopping for support.](fig-07-report-anatomy.svg)

## What It Actually Looks Like {#the-proof}

Excerpts from an unedited run on a genuinely hard methods question — bridging statistical association to biological mechanism in in silico cell models.

:::sample SAMPLE OUTPUT — INVESTIGATE · RUN 436S · 33 PAPERS CITED

> The system flagged this itself. It is the faithfulness gate refusing to let a clean-looking answer stand on evidence that did not fully support it.

#### Direct answer

Current evidence supports the integration of fine-mapping-informed linking and probabilistic approaches as the most effective strategies for bridging statistical association to biological mechanisms in cell modeling. This approach appears to yield more directly testable gene hypotheses and better accommodates the complexities of allelic heterogeneity compared to strict GWAS–QTL colocalization. However, the role of regulatory network propagation remains uncertain, as it lacks the causal anchoring necessary for robust gene prioritization.

#### Evidence analysis — quoted, with numbers

In evaluations of evidence-integration for gene mapping, FABIO was reported to reduce causal gene set size by 27.9%–36.9% versus existing approaches across traits; in simulations, FABIO also showed lower average false inclusion, with 0.22 false genes per 95% credible set for FABIO vs 0.35 for FOCUS. PMID 39621803

In analyses of colocalization that model multiple signals, non-primary eQTL signals accounted for 17% of all colocalizations, and conditional signal isolation prior to coloc yielded 37% more colocalizations than using marginal data. The most plausible reading is that accounting for secondary signals recovers biologically relevant overlaps that single-signal colocalization systematically misses. PMID 39606410, PMID 39711576

#### Conflict analysis — the part nothing else does

Whether strict GWAS–eQTL colocalization should be treated as the primary linkage criterion:

Side A: eQTL resources and statistical colocalization are valuable for mapping GWAS loci to candidate causal genes. PMID 35643189

Side B: Large-scale integration results show that relying on strict colocalization alone can miss biologically relevant links. PMID 39173627

Source of disagreement: Side A emphasises colocalization's utility as a mapping tool; Side B emphasises the practical limits of treating it as the sole gate for gene nomination.

→ Better supported: Side B — consistent with the judgment that moving beyond strict GWAS–QTL colocalization is often necessary in practice, with strict colocalization better viewed as a high-specificity subset within broader integration.

---

retrieved 3,604 · screened in 55 · yielded evidence 48 · cited 33 · run time 436 s · figures embedded from PMC 2
:::

Notice what the system was willing to say: the evidence was insufficient, one method family is weaker than the others, and three separate disagreements remain unresolved. That is what a colleague tells you. It is not what a demo tells you.

## Depth Is Common. Auditability Is Not. {#how-it-compares}

Plenty of tools will read a lot of papers for you. The question a researcher actually has to answer is whether they can defend the output in a lab meeting.

![Categories, not vendors. The top-right quadrant requires two things at once: retrieval that unions many independent channels, and verification that runs as code rather than as instructions to a model.](fig-08-positioning.svg)

| What researchers ask | What Investigate does about it |
| --- | --- |
| “Did it miss the paper that contradicts me?” | Six independent retrieval channels, a second feedback round, and a rule that every drug, trial or assay named in the question keeps a first-hand paper in the final set. |
| “Is this number real?” | Every quote is verified as a literal substring of the source before it can be cited, and each citation carries its source sentence and the section it came from. |
| “What does the field actually disagree about?” | A dedicated conflict section where the two sides must cite different papers and the write-up must name the source of disagreement — species, assay, threshold, population, sample size. |
| “Can I trust the confidence?” | Every conclusion is inference-checked against its own cited evidence. Failures are surfaced at the top of the report, not hidden. |
| “Can I reproduce this?” | A fixed pipeline, a published paper funnel, and a stated cost and runtime per report. |

## Search Mode, for When You Already Know What You Want {#search-mode}

Investigate is for open questions and takes minutes. Search Mode answers a scoped ask in seconds, with two independent dials over the corpus.

![The two dials are independent, so they compose: reviews + high impact to orient in a new field, primary + recent to see what was actually observed this year. “Reviews only” is fail-closed — a primary study titled “Kinase inhibitors: an overview” is read and rejected rather than passed through on its title.](fig-09-search-mode.svg)

## Every Sentence Traces Back to a Sentence in a Paper {#guarantees}

Investigate takes eight to fifteen minutes and costs a few tens of cents, because the alternative — an answer you have to verify yourself — costs an afternoon. You get a six-section report, a paper funnel you can audit, the verbatim source sentence behind every citation, an explicit account of what the field disagrees about, and an honest note when the evidence would not carry the conclusion.

- **Grounded by construction.** Papers are compressed to verbatim evidence before any reasoning happens. Nothing enters the report un-quoted.
- **Recall-first by design.** Six channels, round-robin fusion and named-entity pinning, measured at 0.891 recall of decisive papers.
- **Built on a real graph.** 33.4M PubMed abstracts and 14.6M relationships between 3.3M terms, used for retrieval, figures and fact cross-checking.
