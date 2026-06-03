# Variant & GWAS Interpretation
### Interpret locus and variant evidence with citation grounding.

## Typical inputs
- 200 fine-mapped locus genes
- Gene:variant strings from exome sequencing

## What GLKB returns
Functional evidence summaries, model organism phenotype context, domain-level notes, and PMIDs for each interpreted item.

## Recommended workflow
1. Submit genes or variants as `items`.
2. Keep one interpretation template for the full run.
3. Parse streamed responses into a structured table.
4. Track "none found" cases explicitly.

## Why this is useful
Locus and variant interpretation often mixes strong and sparse evidence. GLKB keeps the output explicit about what is supported and what is not found.