# Prompt Templates
### Define reusable prompts for consistent, schema-driven output.

## Template anatomy
A prompt template is shared across all items in the batch and uses `{item}` as the placeholder for each current target.

```text
In 2 sentences, what is the role of {item} in cancer? Give up to 2 PMIDs.
```

## Use one schema per batch
When your prompt template requests structured fields, for example `function`, `disease`, and `pmids`, the agent populates only the fields it can support.

Unsupported fields are left empty and are never guessed or inferred beyond what the evidence allows.

## Citation-first behavior
Every claim should be grounded in returned evidence. If supporting literature is not found for a field, mark it as empty or "none found" instead of forcing completion.

## Reproducibility rule
For consistent outputs across reruns:

1. Keep the same prompt template text.
2. Keep the same item list ordering.
3. Keep the same expected output schema.

This gives output that is easier to compare, parse, and audit.