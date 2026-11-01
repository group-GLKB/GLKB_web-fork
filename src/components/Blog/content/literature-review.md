---
slug: literature-review
kicker: GLKB · product article
date: Nov 1, 2026
cta: [Try Literature Review →](/literature-review)
cardTitle: Literature Review: weeks of groundwork, done in minutes
readNext: investigate-auditable-research
toc:
  - [At a Glance](#at-a-glance)
  - [What It Does](#what-it-does)
    - [How It Works](#how-it-works)
    - [What You Receive](#what-you-receive)
  - [How We Tested It](#how-we-tested)
    - [The Problem](#the-problem)
    - [A Fair Test](#fair-test)
    - [The Answer Key](#answer-key)
  - [Results](#results)
    - [Same Papers](#same-papers)
    - [Same Library](#same-library)
    - [Why Fairness Matters](#why-fairness-matters)
  - [Built for Real Reviews](#built-for-real-reviews)
    - [Using Your Draft](#using-your-draft)
  - [Get Started](#get-started)
---

# GLKB Literature Review: Weeks of Groundwork, Done in Minutes

Enter a biomedical topic and GLKB writes you a structured, fully cited draft review. Graded against 2,042 reviews published by experts, the agent behind it outscored every review-writing tool we tested, including leading commercial agents.

## At a Glance {#at-a-glance}

A good literature review takes weeks. Most of that time goes into three tasks: finding the right papers, reading them, and working out how their findings fit together. GLKB Literature Review does all three for you.

You enter a topic, for example "mechanisms of osimertinib resistance in EGFR-mutant lung cancer". About ten to fifteen minutes later, you have a draft review. It is organized into sections like a published review, and every statement is linked to the papers behind it.

Behind it is SCRIBE, a review-writing agent developed by our lab at the University of Michigan. To find out how good it really is, we built the most demanding test we could: 2,042 reviews already published in PubMed Central, used as an answer key. The results are in our new paper on arXiv (2609.32318). When every tool worked from the same papers, SCRIBE scored highest, and it was confirmed ahead of every commercial and academic tool in the comparison.

| Metric | Value |
| --- | --- |
| Published biomedical reviews used as the answer key | 2,042 |
| Claims extracted from those reviews | 246,102 |
| SCRIBE's overall score, all tools given the same papers | 0.606 |
| Best score among the other tools | 0.541 |
| SCRIBE's rank range among 13 systems | 1–2 |

## What It Does {#what-it-does}

Most AI writing tools read a batch of papers and produce text in one pass. The result often sounds right, but you cannot see which papers were used, or why a claim sits where it does. SCRIBE works differently. It follows the same steps an experienced reviewer would, one at a time, and each step builds on a fixed result from the step before.

### How It Works {#how-it-works}

![Four steps, in a fixed order. Each step works only from what the previous step handed over, so no new material can slip into the review halfway through.](lr-01-pipeline.svg)

**Step 1: Lock the evidence.** SCRIBE searches a library of more than 26 million biomedical papers and adds recent PubMed results. Where PubMed Central allows it, it reads the full text, not just the abstract. Then it locks the set of papers. From this point on, nothing new can be added, so every citation in your draft comes from a known, fixed list.

**Step 2: Map the claims.** Before writing a single sentence, SCRIBE records what each paper claims. It also records how those claims relate to each other. For example, one finding may explain the mechanism behind another, contradict it, or hold only in a specific patient group.

**Step 3: Plan the outline.** SCRIBE assigns each claim, together with the papers that support it, to one section of the review. This is the step that turns a pile of findings into an argument. It is also where most AI tools struggle, and where SCRIBE leads most clearly.

**Step 4: Write each section.** SCRIBE writes every section only from the material assigned to it. A section on resistance mechanisms is therefore built from the papers on resistance mechanisms, not from the whole pile.

### What You Receive {#what-you-receive}

- **A structured draft review**, divided into sections, the way a published review is.
- **Numbered citations** for each statement, with a full reference list at the end.
- **Your own papers, if you want them.** Add the papers you already rely on, and SCRIBE works them into the review.
- **A saved copy in your History**, so you can come back to it at any time.

In GLKB today, SCRIBE runs on OpenAI models through our own review harness. Our own model, trained specifically for review writing, is coming soon.

## How We Tested It {#how-we-tested}

Many AI tools claim to write better reviews than their competitors. Most of those claims rest on comparisons that are not controlled. We wanted a test that a biomedical researcher could trust, and then we wanted to win it.

### The Problem With Most Comparisons {#the-problem}

A review can only be as good as the papers it is built from. If one tool is given a better reading list, its review will score higher, even if its writing is worse.

Think of a western blot. If one lane holds twice as much protein as the other, a brighter band tells you nothing about the antibody. You first check the loading control. Comparisons of AI review tools have the same problem. The "protein" is the set of papers each tool worked from, and most published comparisons never check it.

The example below, taken from our paper, shows how easily this reverses a result.

![Tool A is the better writer, but it has the weaker search. When each tool uses its own search, B appears to win. When both receive the same papers, A wins clearly. More test topics would not fix this; only matching the inputs does.](lr-02-unfair.svg)

### Our Approach: Check the Inputs First {#fair-test}

Our method, which the paper calls compositional controllability, follows three rules that any experimentalist will recognize.

1. **Decide what you are comparing.** You can compare whole tools, from question to finished review. In that case, a better search is part of a better tool. Or you can compare one step, such as the writing. In that case, differences in the papers each tool received are a confounder.
2. **Check the inputs before reading any score.** We measure how different the inputs are and how much that difference could move the score. If it could move the score too much, the comparison is refused. Like a pre-registered analysis, the decision cannot depend on which tool we hoped would win.
3. **Declare a winner only when the gap is clearly larger.** A winner is confirmed only when the score gap exceeds both random variation and any remaining difference in inputs. Otherwise, the result is "too close to call".

The outcome is a leaderboard with controls. Each tool receives a rank range instead of a single rank, which works like a confidence interval for its position.

### The Answer Key: 2,042 Published Reviews {#answer-key}

To grade a review, you need to know what human experts concluded and which papers they relied on. We built this answer key, called BioLitBench, from open-access reviews in PubMed Central. The reviews were published between 2016 and 2025 and cover 6 fields and 48 subfields of biomedicine.

Each review was broken down into individual claims, 246,102 in total. For each claim, we recorded which papers it cites and how it connects to other claims. This lets us check far more than wording. We can check whether an AI review reaches the same conclusions, from the same evidence, organized in the same way.

There is rarely only one correct review of a topic. Each test topic therefore comes with 4 to 9 other published reviews on the same subject. Scores are placed on a human scale: 0 is roughly the level of the weaker human reviews on that topic, and 1 matches the published review being graded against.

| Score | The question it answers |
| --- | --- |
| Retrieval | Did the tool find the papers the human authors cited? |
| Synthesis | Does the review make the same claims as the human review? |
| Reasoning | Does it connect claims the same way, for example by mechanism, contrast or condition? |
| Planning | Is it organized like a human review, with claims and papers in the right sections? |
| Writing | How do its sections compare with those written by human experts? |
| Form | Do its structure and style fall within the range of human reviews? |

We ran the test under two conditions. Under **same papers**, every tool receives the human review's own reference list. Under **same library**, every tool must find its own papers in one shared collection of 26.6 million papers.

## Results {#results}

### Same Papers: Highest Score, Ahead of Every Other Tool {#same-papers}

This condition isolates what a tool does with the evidence: how it extracts claims, organizes them and writes them up. Every tool starts from the same reference list, so the comparison is fully controlled.

![Overall scores when every tool works from the human review's reference list. Rank range shows every position a tool could hold, given the results that were confirmed. 13 systems were ranked; one commercial system is not reported in the paper.](lr-03-leaderboard.svg)

- **SCRIBE scored 0.606, the highest of any system.**
- **It was confirmed ahead of every other tool**, including Claude Science, Claude Code, an OpenAI agent, Elicit's Systematic Review and every published academic system. The only system it could not be separated from was its own untrained version.
- **The design is what wins.** On an open 27-billion-parameter model, SCRIBE scored 0.606. The same design running on gpt-5.6-luna scored 0.564, still higher on average than every other tool tested.

### Same Library: Still First When Each Tool Finds Its Own Papers {#same-library}

In everyday use, nobody hands you the reference list. This condition tests the whole workflow, search included. Finding the right papers is much harder, so every score is lower.

| System | Overall | Retrieval | Rank range |
| --- | --- | --- | --- |
| SCRIBE (GLKB) | **0.487** | 0.335 | 1–7 |
| SurveyGen-I | 0.460 | 0.336 | 1–9 |
| Claude Code | 0.458 | 0.227 | 1–8 |
| Claude Science | 0.456 | 0.287 | 1–8 |
| OpenAI tool loop | 0.437 | 0.172 | 3–10 |
| AutoSurvey | 0.419 | 0.238 | 5–11 |

SCRIBE again had the highest overall score. It was confirmed ahead of the OpenAI agent, AutoSurvey, SurveyG and LLM×MapReduce. At finding the papers that human authors actually cited, it matched the best academic system, and it found more of them than any commercial agent.

### Why a Fair Test Matters {#why-fairness-matters}

To show what the input check changes, we applied it to seven published academic systems. Together they form 21 head-to-head comparisons.

A careful conventional analysis, with paired tests and corrections for multiple comparisons, declared a winner in 14 of them. Our test refused 11 of the 21 before looking at any score, because the systems had not received comparable inputs. One system was the only one given the human review's own reference list. Another ran on a different underlying model from the rest.

![Each square is one comparison. Statistics can tell you that a difference is real, but not that the comparison was fair. Half of the conventional verdicts came from comparisons that should never have been made.](lr-04-comparisons.svg)

The conventional analysis ranked first the one system that had been handed the reading list. Its verdict was statistically sound, but it measured the setup, not the system. That is why every SCRIBE result above comes from matched inputs.

:::callout Can the confirmed results be trusted?
We checked the test on cases where no real difference exists. Three runs of the same model, compared against each other, produced no confirmed differences at all (0 of 114). Removing any one subfield from the test set never reversed a confirmed result.
:::

## Built for How Real Reviews Fail {#built-for-real-reviews}

Grading each step separately showed us where AI-written reviews break down. SCRIBE is designed around exactly these weak points.

- **Organizing the evidence is the hardest step.** Planning had the lowest scores of all six measures, for every tool. Human reviewers place a given paper in about 14% of their sections, while many AI tools cite the whole evidence set in nearly every section. SCRIBE assigns each paper to the sections where it belongs, and it had the best planning score of any tool given the same papers.
- **Polishing can delete findings.** Many tools finish with a pass that improves the wording. In three cases, that pass also removed findings the earlier draft had covered. SCRIBE grades every step on its own, so a loss like this cannot hide behind better prose.
- **Finding the right papers separates tools most.** When tools search for themselves, retrieval is what separates them. Because SCRIBE grades its search on its own, we could see exactly where to improve it. Our rebuilt search more than doubled its retrieval score, from 0.156 to 0.335.
- **Fluent text is not the same as cited text.** Large language models already know a great deal of biology and can write convincing text from memory. SCRIBE locks its papers first and writes each section only from the papers assigned to it, so the review is built on the evidence in front of it.

### Getting the Most From Your Draft {#using-your-draft}

Your draft gives you weeks of groundwork in minutes. You stay the expert, and a few quick checks make the most of it.

- **Spot-check the key citations.** Open the papers behind your most important claims and confirm they say what you need.
- **Add what you know.** If a paper you rely on is missing, add it as one of your own papers and run the review again.
- **Shape the argument.** Use the outline as a starting point, then reorder, merge or expand sections to tell your story.
- **Review before you publish.** As with any draft, read it carefully before using it in a manuscript, a grant, or a clinical or policy decision.

## Get Started {#get-started}

GLKB Literature Review is available now with a free GLKB account. On the home page, select the Literature Review tab above the search bar and enter your topic. Your draft will be ready in about ten to fifteen minutes.

Want the details? The full study, "What Can a Leaderboard Certify? Compositional Controllability for Fair Evaluation and Training of Biomedical Literature-Review Agents", is on [arXiv (2609.32318)](https://arxiv.org/abs/2609.32318). The code, the benchmark inputs and the analysis scripts are public in the [project repository](https://github.com/shawnzhg/LitReview-SCRIBE).

:::callout Tested against the experts
SCRIBE was graded against 2,042 reviews written by experts, under conditions where every tool had a fair chance. It came out on top. Try it on your next review.
:::
