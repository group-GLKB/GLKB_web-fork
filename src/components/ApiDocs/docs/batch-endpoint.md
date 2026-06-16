# Batch Endpoint
### Run a prompt template across a list of entities and stream back cited answers.

## Endpoint

```POST
POST /apps/glkb/users/{user_id}/batch
```

## Authentication

```
Authorization: Bearer <GLKB_API_KEY>
```

## Path parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `user_id` | string | Your GLKB user identifier |

## Request body

```json
{
  "items": ["TP53", "KRAS", "BRCA1"],
  "prompt_template": "What is the role of {item} in cancer? Give 2 PMIDs.",
  "concurrency": 5
}
```

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `items` | array of strings | Yes | Entities to query — genes, variants, drugs, proteins, or any term the knowledge graph recognizes |
| `prompt_template` | string | Yes | Prompt run for each item. Must include `{item}` as a placeholder |
| `concurrency` | integer | No | Number of items processed in parallel. Default `5`, max `50` |

## Response format

The API responds as a Server-Sent Events stream. Each event is a JSON object on a `data:` line.

### Per-item result (`status: "done"`)

Emitted once per item as it completes.

```json
{
  "status": "done",
  "index": 0,
  "item": "TP53",
  "response": "TP53 encodes a tumor suppressor mutated in over 50% of cancers [PMID 28982660]."
}
```

| Field | Type | Description |
| --- | --- | --- |
| `status` | string | `"done"` |
| `idx` | integer | Position of the item in the original list |
| `item` | string | The entity that was queried |
| `response` | string | The agent's cited answer |

### Per-item result (`status: "complete"`)

Emitted once after all items finish.

```json
{
  "status": "complete",
  "succeeded": 3,
  "total": 3
}
```

| Field | Type | Description |
| --- | --- | --- |
| `status` | string | `"complete"` |
| `succeeded` | integer | Number of items that returned a result |
| `total` | integer | Total items submitted |

## Error codes

| Code | Meaning |
| --- | --- |
| `400` | Bad request — missing or invalid parameters |
| `401` | Unauthorized — missing or invalid API key |
| `422` | Unprocessable — prompt template missing `{item}`, or items list empty |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

## Code examples

```python
import requests, json, os

with requests.post(
    "https://api.glkb.dev/apps/glkb/users/me/batch",
    headers={"Authorization": f"Bearer {os.environ['GLKB_API_KEY']}"},
    json={
        "items": ["TP53", "KRAS", "BRCA1"],
        "prompt_template": "Role of {item} in cancer? Up to 2 PMIDs.",
        "concurrency": 5,
    },
    stream=True,
    timeout=300,
) as r:
    r.raise_for_status()
    for line in r.iter_lines():
        if line and line.startswith(b"data:"):
            event = json.loads(line[5:])
            if event["status"] == "done":
                print(f"{event['item']}: {event['response']}")
```

```bash
curl -N -X POST "https://api.glkb.dev/apps/glkb/users/me/batch" \
  -H "Authorization: Bearer $GLKB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "items": ["TP53", "KRAS", "BRCA1"],
    "prompt_template": "Role of {item} in cancer? Up to 2 PMIDs.",
    "concurrency": 5
  }'
```