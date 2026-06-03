# Annotating Experimental Results
### Convert DEG or proteomics outputs into literature-grounded annotations.

## Typical inputs
- 800 differentially expressed genes from RNA-seq
- 400 proteins from a mass-spec experiment

## What GLKB returns
Known function, disease association, perturbation direction, and evidence references for each item.

## Recommended workflow
1. Send experiment outputs as a batch `items` list.
2. Ask for a fixed annotation schema in `prompt_template`.
3. Use streamed results to build annotation tables.
4. Keep PMIDs with each annotation for auditability.

## Reproducibility notes
Use the same prompt template and item list whenever you need a rerun that is comparable to prior analyses.