# Prompt Templates
### How to write prompts that get structured, citation-grounded outputs.

## The `{item}` placeholder

Every prompt template must include `{item}`. Before each query, the agent substitutes the current entity from your `items` list into that position.

```
# Template
"What is the role of {item} in cancer? Give up to 2 PMIDs."

# Becomes, for each item:
"What is the role of TP53 in cancer? Give up to 2 PMIDs."
"What is the role of KRAS in cancer? Give up to 2 PMIDs."
```

## Requesting structured output

Ask for named fields directly in the prompt. The agent will populate each field from retrieved evidence and leave it empty if no support exists.

```python
PROMPT = """For the gene {item}, return the following fields:
- role: one sentence on its primary biological function
- disease: the most strongly associated disease, or 'none found'
- pmids: up to 3 supporting PubMed IDs, or [] if none

Return only these fields, one per line."""
```

The agent will not guess or infer beyond what the knowledge graph supports. Any field without evidence comes back empty — not fabricated.

## Best practices

**Be explicit about format.** Specify the number of sentences, the field names, and what to return when evidence is absent (e.g. `"none found"`, `[]`). Ambiguous prompts produce inconsistent output.

**Ask for PMIDs.** The agent is designed to cite — if you don't ask for PMIDs, the response may still be grounded but citations won't appear in the output.

**Cap your answer length.** Shorter prompts with tight constraints (`"in 1 sentence"`, `"up to 3 PMIDs"`) produce cleaner, more parseable output than open-ended ones.

## Calibration anchors

For scoring workflows, include known high- and low-confidence entities in your prompt as reference anchors. This keeps scores comparable across runs and across different gene lists.

```python
PROMPT = """Score {item} for evidence of involvement in colorectal cancer.
Return a score from 0-10.

Reference anchors:
- APC: 10 (causal, well established)
- GAPDH: 0 (housekeeping gene, no cancer role)

Return: score (integer), rationale (1 sentence), pmids (up to 2)."""
```

## Mini-batching

To reduce API calls, pack multiple items into a single prompt. This trades per-item isolation for throughput efficiency.

```python
PROMPT = """For each of the following genes: {item}
Return one line per gene in this format:
GENE | role (1 sentence) | top disease | top PMID"""
```

In this pattern, `{item}` receives a comma-separated string of gene names (e.g. `"TP53, KRAS, BRCA1"`). Parse the response by splitting on newlines.