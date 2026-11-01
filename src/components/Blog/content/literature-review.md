---
slug: literature-review
kicker: GLKB · product article
date: Nov 1, 2026
cta: [Try Literature Review →](/literature-review)
cardTitle: Literature Review: biomedical reviews, built claim by claim
readNext: investigate-auditable-research
toc:
  - [At a Glance](#at-a-glance)
  - [What It Does](#what-it-does)
    - [How It Works](#how-it-works)
    - [Under the Hood](#under-the-hood)
    - [What You Receive](#what-you-receive)
  - [How We Tested It](#how-we-tested)
    - [The Problem](#the-problem)
    - [A Fair Test](#fair-test)
    - [The Math](#the-math)
    - [The Answer Key](#answer-key)
  - [Results](#results)
    - [Same Papers](#same-papers)
    - [Same Library](#same-library)
    - [Why Fairness Matters](#why-fairness-matters)
  - [Built for Real Reviews](#built-for-real-reviews)
    - [Using Your Draft](#using-your-draft)
  - [Get Started](#get-started)
    - [Open and Reproducible](#reproducible)
    - [Cite This Work](#cite)
---

# GLKB Literature Review: Biomedical Reviews, Built Claim by Claim

Enter a biomedical topic and GLKB writes you a structured, fully cited draft review. Graded against 2,042 reviews published by experts, the agent behind it outscored every review-writing tool we tested, including leading commercial agents.

## At a Glance {#at-a-glance}

A good literature review takes weeks. Most of that time goes into three tasks: finding the right papers, reading them, and working out how their findings fit together. GLKB Literature Review does all three for you.

You enter a topic, for example "mechanisms of osimertinib resistance in EGFR-mutant lung cancer". About ten to fifteen minutes later, you have a draft review. It is organized into sections like a published review, and every statement is linked to the papers behind it.

Behind it is SCRIBE, a review-writing agent developed by our lab at the University of Michigan. To find out how good it really is, we built the most demanding test we could: 2,042 reviews already published in PubMed Central, used as an answer key. When every tool worked from the same papers, SCRIBE scored highest, and it was confirmed ahead of every commercial and academic tool in the comparison.

| Metric | Value |
| --- | --- |
| Published biomedical reviews used as the answer key | 2,042 |
| Claims extracted from those reviews | 246,102 |
| SCRIBE's overall score, all tools given the same papers | 0.606 |
| Best score among the other tools | 0.541 |
| SCRIBE's rank range among 13 systems | 1–2 |

The full study is "What Can a Leaderboard Certify? Compositional Controllability for Fair Evaluation and Training of Biomedical Literature-Review Agents" by Zhaowei Han, Xiang Zhang, Lingxiao Guan, Danqi Hu, Kai Liu, Kevin Chang and Jie Liu, University of Michigan. It is available on [arXiv (2609.32318)](https://arxiv.org/abs/2609.32318).

## What It Does {#what-it-does}

Most AI writing tools read a batch of papers and produce text in one pass. The result often sounds right, but you cannot see which papers were used, or why a claim sits where it does. SCRIBE works differently. It follows the same steps an experienced reviewer would, one at a time, and each step builds on a fixed result from the step before.

### How It Works {#how-it-works}

![Four steps, in a fixed order. Each step works only from what the previous step handed over, so no new material can slip into the review halfway through.](lr-01-pipeline.svg)

**Step 1: Lock the evidence.** SCRIBE searches a library of more than 26 million biomedical papers and adds recent PubMed results. Where PubMed Central allows it, it reads the full text, not just the abstract. Then it locks the set of papers. From this point on, nothing new can be added, so every citation in your draft comes from a known, fixed list.

**Step 2: Map the claims.** Before writing a single sentence, SCRIBE records what each paper claims. It also records how those claims relate to each other. For example, one finding may explain the mechanism behind another, contradict it, or hold only in a specific patient group.

**Step 3: Plan the outline.** SCRIBE assigns each claim, together with the papers that support it, to one section of the review. This is the step that turns a pile of findings into an argument. It is also where most AI tools struggle, and where SCRIBE leads most clearly.

**Step 4: Write each section.** SCRIBE writes every section only from the material assigned to it. A section on resistance mechanisms is therefore built from the papers on resistance mechanisms, not from the whole pile.

### Under the Hood {#under-the-hood}

Three engineering choices make this design work.

- **The evidence lock is enforced, not requested.** SCRIBE fixes its paper set before the first writing call. If any search tool is still reachable after that point, the run fails rather than continuing. The writer cannot quietly pull in new papers.
- **Every hand-off carries a fingerprint.** Each step's output is fingerprinted, and that fingerprint becomes the next step's input record. A run can therefore be audited step by step, like a lab notebook.
- **Every step can be graded and trained on its own.** Because two versions of a step see exactly the same input, the difference in their scores is a clean measure of that step. We use this signal to train the outline step directly with reinforcement learning, instead of crediting or blaming everything on the final review.

In the paper, SCRIBE runs on an open 27-billion-parameter model whose weights are never changed. What is trained is a small add-on for the outline step. The table below summarizes the setup.

| Component | Setup in the paper |
| --- | --- |
| Base model | Qwen3.8-27B, frozen (greedy decoding, 65,536-token generation context) |
| What is trained | A 14–16M-parameter KV-Skill module for the outline step; it adds no prompt tokens and leaves the model's weights unchanged |
| Training method | GRPO on 192 tasks, rewarded by BioLitBench scores at the outline step's output |
| Data separation | Training uses only the 1,842 training reviews, never the test topics, their references or their peer reviews |

In GLKB today, SCRIBE runs on OpenAI models through our own review harness. Our own model, trained specifically for review writing, is coming soon.

### What You Receive {#what-you-receive}

- **A structured draft review**, divided into sections, the way a published review is.
- **Numbered citations** for each statement, with a full reference list at the end.
- **Your own papers, if you want them.** Add the papers you already rely on, and SCRIBE works them into the review.
- **A saved copy in your History**, so you can come back to it at any time.

## How We Tested It {#how-we-tested}

Many AI tools claim to write better reviews than their competitors. Most of those claims rest on comparisons that are not controlled. We wanted a test that a biomedical researcher could trust, and then we wanted to win it.

### The Problem With Most Comparisons {#the-problem}

A review can only be as good as the papers it is built from. If one tool is given a better reading list, its review will score higher, even if its writing is worse.

Think of a western blot. If one lane holds twice as much protein as the other, a brighter band tells you nothing about the antibody. You first check the loading control. Comparisons of AI review tools have the same problem. The "protein" is the set of papers each tool worked from, and most published comparisons never check it.

This happens in practice. One production screening assistant reported 96.9% sensitivity across 108 Cochrane reviews and described this as better than a single human screener. The human figures, however, came from a different study, with different reviews and a different reference standard. It is like comparing a drug's response rate in one trial with the placebo arm of another.

The example below, taken from our paper, shows how easily an uncontrolled comparison reverses a result.

![Tool A is the better writer, but it has the weaker search. When each tool uses its own search, B appears to win. When both receive the same papers, A wins clearly. More test topics would not fix this; only matching the inputs does.](lr-02-unfair.svg)

### Our Approach: Check the Inputs First {#fair-test}

Our method, which the paper calls compositional controllability, follows three rules that any experimentalist will recognize.

1. **Decide what you are comparing.** You can compare whole tools, from question to finished review. In that case, a better search is part of a better tool. Or you can compare one step, such as the writing. The paper calls the stretch being compared a comparison window. Differences in what enters that window are a confounder.
2. **Check the inputs before reading any score.** We measure how different the inputs are and how much that difference could move the score. If it could move the score by more than a tolerance fixed in advance, the comparison is refused. Like a pre-registered analysis, the decision cannot depend on which tool we hoped would win.
3. **Declare a winner only when the gap is clearly larger.** A winner is confirmed only when the score gap exceeds both random variation across topics and the largest distortion any remaining input difference could cause. Otherwise, the result is "too close to call".

The outcome is a leaderboard with controls. Each tool receives a rank range instead of a single rank: every position it could hold in some ordering consistent with the confirmed results. It works like a confidence interval for a rank.

### The Math Behind the Test {#the-math}

The paper's central result (Theorem 1) bounds how far an observed score gap can sit from the gap you would see with perfectly matched inputs:

> |Δobs − Δ\*| ≤ ε\_outside

Here Δobs is the gap you measure, Δ\* is the gap under matched inputs, and ε\_outside is computed only from differences outside the comparison window. It adds up four kinds of mismatch, each scaled by how strongly the pipeline amplifies it:

- **Input distance:** how far each tool's actual inputs are from the common input, measured as a Wasserstein distance.
- **Discontinuities:** slack for jumps such as truncation, charged only when the inputs differ.
- **Output handling:** differences in how each tool's output is turned into the text that gets scored.
- **Protocol:** any remaining imbalance in budget, alignment or annotation.

A comparison is refused when ε\_outside exceeds the declared tolerance. A direction is confirmed when the estimated gap exceeds the sampling radius plus ε\_outside. As a result, a confirmed direction is wrong with probability at most δ + δ′, the two error rates fixed in advance. Nothing inside the window is constrained, so the two tools are free to work in completely different ways.

### The Answer Key: 2,042 Published Reviews {#answer-key}

To grade a review, you need to know what human experts concluded and which papers they relied on. We built this answer key, called BioLitBench, from 2,063 open-access articles in PubMed Central, mostly reviews, published between 2016 and 2025. A language model broke each one into sentence-level claims, recorded which papers each claim cites, and labeled how claims relate. 2,042 articles came through cleanly.

![A review becomes a map of claims. Each claim sits in a section, cites papers, and connects to other claims through labeled relationships.](lr-05-claim-map.svg)

| BioLitBench | Count |
| --- | --- |
| Reviews in the answer key | 2,042 |
| Claims (median 108 per review) | 246,102 |
| Labeled relationships between claims (8 types) | 832,487 |
| Look-alike claim pairs that are unrelated (hard negatives) | 103,242 |
| Unique cited papers | 224,140 |
| Fields, subfields and topics | 6, 48 and 230 |
| Reviews for training and held out for testing | 1,842 and 200 |
| Test topics (spread across 23 subfields) | 50 |

Two quality checks support the answer key. On average, 87.4% of each review's references resolved to a PubMed record. An automated reader judged 87.6% of claims to be supported by at least one cited abstract.

The hard negatives matter. They are pairs of claims that look alike but are unrelated. They act as traps, so a tool cannot score well just by writing anything on-topic.

There is rarely only one correct review of a topic. Each test topic therefore comes with 4 to 9 other published reviews on the same subject. Scores are placed on a human scale: 0 is the 10th percentile of those human reviews, and 1 matches the published review being graded against. A score of 0.6 means a tool got about 60% of the way from a weak human review to the real one.

| Score | The question it answers |
| --- | --- |
| Retrieval | Did the tool find the papers the human authors cited? |
| Synthesis | Does the review make the same claims as the human review? |
| Reasoning | Does it connect claims the same way, for example by mechanism, contrast or condition? |
| Planning | Is it organized like a human review, with claims and papers in the right sections? |
| Writing | How do its sections compare with those written by human experts? |
| Form | Do its structure and style fall within the range of human reviews? |

The six scores combine 34 measurements. These were kept from 52 candidates after dropping any that could not tell tools apart, or that rewarded following instructions rather than quality. The overall score weights the six equally.

We ran the test under two conditions. Under **same papers**, every tool receives the human review's own reference list. Under **same library**, every tool must find its own papers in one frozen collection of 26.6 million papers. In both, only papers published before the review's cutoff date are available.

## Results {#results}

All results use the 50 held-out test topics across 23 subfields. Winners are confirmed against random variation across subfields, corrected for multiple comparisons. Every review was trimmed to its topic's target length, so a longer review does not win just by being longer.

### Same Papers: Highest Score, Ahead of Every Other Tool {#same-papers}

This condition isolates what a tool does with the evidence: how it extracts claims, organizes them and writes them up. Every tool starts from the same reference list, so the comparison is fully controlled.

![Overall scores when every tool works from the human review's reference list. Rank range shows every position a tool could hold, given the results that were confirmed. 13 systems were ranked; one commercial system is not reported in the paper.](lr-03-leaderboard.svg)

- **SCRIBE scored 0.606, the highest of any system.**
- **It was confirmed ahead of every other tool**, including Claude Science, Claude Code, an OpenAI agent, Elicit's Systematic Review and every published academic system. The only system it could not be separated from was its own untrained version.
- **It led on planning by a wide margin.** SCRIBE's planning score was 0.319. The best commercial tool reached 0.185.
- **The design is what wins.** On the open model, SCRIBE scored 0.606. The same design running on gpt-5.6-luna scored 0.564, still higher on average than every other tool tested. Even untrained, SCRIBE scored 0.583.

For reference, Claude Science and Claude Code ran on claude-sonnet-5, and the OpenAI tool loop on gpt-5.6-luna. All three reached papers only through the benchmark's tools. Elicit's Systematic Review reads full text where the others read abstracts, and cites at most 80 papers.

### Same Library: Still First When Each Tool Finds Its Own Papers {#same-library}

In everyday use, nobody hands you the reference list. This condition tests the whole workflow, search included. Finding the right papers is much harder, so every score is lower. Search budgets were capped at the largest any other system used on that topic.

| System | Overall | Retrieval | Synthesis | Planning | Rank range |
| --- | --- | --- | --- | --- | --- |
| SCRIBE (GLKB) | **0.487** | 0.335 | 0.523 | 0.250 | 1–7 |
| SurveyGen-I | 0.460 | **0.336** | 0.535 | 0.181 | 1–9 |
| Claude Code | 0.458 | 0.227 | 0.573 | 0.188 | 1–8 |
| Claude Science | 0.456 | 0.287 | 0.598 | 0.164 | 1–8 |
| OpenAI tool loop | 0.437 | 0.172 | **0.665** | 0.126 | 3–10 |
| AutoSurvey | 0.419 | 0.238 | 0.540 | 0.117 | 5–11 |

SCRIBE again had the highest overall score. It was confirmed ahead of the OpenAI agent, AutoSurvey, SurveyG and LLM×MapReduce. At finding the papers that human authors actually cited, it matched the best academic system, and it found more of them than any commercial agent.

### Why a Fair Test Matters {#why-fairness-matters}

To show what the input check changes, we applied it to seven published academic systems: AutoSurvey, SurveyG, SurveyGen-I, SurveyForge, LLM×MapReduce, LiRA and DR-Tulu. Together they form 21 head-to-head comparisons.

A careful conventional analysis declared a winner in 14 of them. It used paired tests, clustering by subfield and correction for multiple comparisons. Our test refused 11 of the 21 before looking at any score.

![Each square is one comparison. Statistics can tell you that a difference is real, but not that the comparison was fair. Half of the conventional verdicts came from comparisons that should never have been made.](lr-04-comparisons.svg)

The reasons were measurable. LiRA was the only system handed the human review's own bibliography. That head start could move a score by up to 0.70–0.73, more than three times the tolerance fixed in advance (median 0.21). DR-Tulu ran on a different underlying model from the other six, a difference outside the comparison window that cannot be bounded at all.

The conventional analysis ranked LiRA first. Its verdict was statistically sound, but it measured the setup, not the system. That is why every SCRIBE result above comes from matched inputs.

:::callout Can the confirmed results be trusted?
We checked the test on cases where no real difference exists. Three runs of the same model, compared against each other, produced no confirmed differences at all (0 of 114). On randomized data, false confirmations occurred at or below the intended rate. Removing any one subfield never reversed a confirmed result.
:::

## Built for How Real Reviews Fail {#built-for-real-reviews}

Grading each step separately showed us where AI-written reviews break down. SCRIBE is designed around exactly these weak points.

**Organizing the evidence is the hardest step.** Planning had the lowest scores of all six measures, for every tool. Human reviewers place a given paper in about 14% of their top-level sections. Many AI pipelines hand their entire evidence set to 94–100% of sections. On a naive measure this looks excellent, because putting every paper everywhere guarantees perfect recall. Corrected for chance, SCRIBE scores 0.15–0.17 on paper placement, against 0.10 for the best other system.

**Polishing can delete findings.** Many tools finish with a refinement pass that improves the wording. When we graded the draft and the final version separately, that pass raised writing by 0.068 and form by 0.115. In three cases, however, it also cut synthesis by 0.072 to 0.113, removing findings the draft had covered. SCRIBE grades every step on its own, so a loss like this cannot hide behind better prose.

**Finding the right papers separates tools most.** When tools search for themselves, retrieval is what separates them. It was also our own weak spot. With an earlier search step, SCRIBE found 50 papers per topic instead of 109, and its claim map shrank from 118 claims to 52. Because each step is graded on its own, the cause was obvious. Our rebuilt search more than doubled the retrieval score, from 0.156 to 0.335.

**Fluent text is not the same as cited text.** We ran one pipeline's writing step with no papers at all. It scored higher on synthesis, reasoning and form than it did with the papers. Large language models already know a great deal of biology and can write convincing text from memory. SCRIBE locks its papers first and writes each section only from the papers assigned to it, so the review is built on the evidence in front of it.

### Getting the Most From Your Draft {#using-your-draft}

Your draft takes care of the searching, reading and organizing. You stay the expert, and a few quick checks make the most of it.

- **Spot-check the key citations.** Open the papers behind your most important claims and confirm they say what you need.
- **Add what you know.** If a paper you rely on is missing, add it as one of your own papers and run the review again.
- **Shape the argument.** Use the outline as a starting point, then reorder, merge or expand sections to tell your story.
- **Review before you publish.** As with any draft, read it carefully before using it in a manuscript, a grant, or a clinical or policy decision.

## Get Started {#get-started}

GLKB Literature Review is available now with a free GLKB account. On the home page, select the Literature Review tab above the search bar and enter your topic. Your draft will be ready in about ten to fifteen minutes.

### Open and Reproducible {#reproducible}

The paper, BioLitBench and SCRIBE are all public. The [project repository](https://github.com/shawnzhg/LitReview-SCRIBE) holds the code, the frozen leaderboard inputs and the analysis scripts. Every academic system ran behind a recorder that logged each model call, and a guard that allowed access only to the shared library. Those logs, fingerprints of each system's code and the cost records are part of the release, so anyone can rerun the analysis.

BioLitBench is built from PubMed Central open-access articles under mixed licences. The 1,119 source articles licensed CC BY or CC0 will be shared directly, with scripts that rebuild the rest from PubMed Central.

### Cite This Work {#cite}

```
@misc{han2026leaderboardcertify,
  title         = {What Can a Leaderboard Certify? Compositional Controllability
                   for Fair Evaluation and Training of Biomedical
                   Literature-Review Agents},
  author        = {Zhaowei Han and Xiang Zhang and Lingxiao Guan and Danqi Hu
                   and Kai Liu and Kevin Chang and Jie Liu},
  year          = {2026},
  eprint        = {2609.32318},
  archivePrefix = {arXiv},
  primaryClass  = {cs.LG},
  url           = {https://arxiv.org/abs/2609.32318}
}
```

:::callout Tested against the experts
SCRIBE was graded against 2,042 reviews written by experts, under conditions where every tool had a fair chance. It came out on top. Try it on your next review.
:::
