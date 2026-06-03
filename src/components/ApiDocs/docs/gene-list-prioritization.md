# Gene List Prioritization
### Rank large candidate gene sets with cited evidence.

## Typical input
A ranked or unranked list such as 1,500 candidate genes from a screen or GWAS.

## What GLKB returns
For each gene, GLKB can return literature score, supporting evidence text, and PMIDs so that prioritization remains traceable.

## Recommended workflow
1. Submit the full gene list to the batch endpoint.
2. Use one fixed prompt template for all genes.
3. Stream and store per-gene outputs.
4. Sort by evidence strength and citation support.

## Why this pattern works
Manual review does not scale to large lists. The GLKB batch pattern lets you evaluate all candidates in one pass while keeping every claim tied to source evidence.