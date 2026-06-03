# Drug Target Investigation
### Build target dossiers with mechanism, genetics, and evidence links.

## Typical input
A focused list such as 50 candidate kinase targets.

## What GLKB returns
Mechanism-focused summaries, human genetics context, known modulators, clinical stage clues, and PMIDs.

## Recommended workflow
1. Group target candidates into one batch request.
2. Use one dossier-style prompt template.
3. Capture streamed output per target.
4. Assemble a comparison table for triage.

## Output quality guardrails
Treat citation coverage as a first-class signal. If a section has no support, keep it empty instead of inferring unsupported conclusions.