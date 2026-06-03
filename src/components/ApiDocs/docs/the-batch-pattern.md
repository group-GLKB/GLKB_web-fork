# The Batch Pattern
### Structure high-throughput runs with deterministic output.

## Why batch
The GLKB API is designed for list-based workloads. You can process hundreds of genes, variants, or drug targets in one run and receive streamed, cited answers for each item.

This pattern keeps request overhead low while preserving traceability and reproducibility across all items.

## Request shape
Use one request with a shared `prompt_template` and an `items` list:

```json
{
  "items": ["TP53", "EGFR", "BRCA1"],
  "prompt_template": "In 2 sentences, what is the role of {item} in cancer? Give up to 2 PMIDs.",
  "concurrency": 5
}
```

## Streaming lifecycle
A batch call streams progress as Server-Sent Events (SSE):

| Field | Meaning |
| --- | --- |
| `status` | `done` per result, `complete` when the whole batch finishes |
| `response` | Model output for the current item |
| `item` | Current list item being processed |
| `pmids` | Citation IDs returned with the current answer |

## Deterministic execution pattern
For reproducible runs, keep the same item list and the same prompt template. In GLKB, the same prompt template applied to the same item list produces consistent, comparable output across runs.