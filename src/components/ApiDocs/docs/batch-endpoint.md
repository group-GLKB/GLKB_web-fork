# Batch Endpoint
### Submit list-based workloads and stream per-item responses.

## Endpoint
The Quickstart flow uses:

```text
POST /apps/glkb/users/me/batch
```

## Request body
```json
{
  "items": ["TP53", "EGFR", "BRCA1"],
  "prompt_template": "In 2 sentences, what is the role of {item} in cancer? Give up to 2 PMIDs.",
  "concurrency": 5
}
```

## Streaming response
The endpoint returns Server-Sent Events (SSE) and emits one event per completed item.

| Field | Meaning |
| --- | --- |
| `status` | `done` for item-level completion, `complete` for batch completion |
| `item` | Item currently reported in the event |
| `response` | Answer text for that item |
| `pmids` | Citation IDs returned with the answer |

## Auth
Pass your API key as a bearer token:

```text
Authorization: Bearer <GLKB_API_KEY>
```