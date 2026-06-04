# The Batch Pattern
### One prompt, run across every item in your list.

## How it works

A batch request has two parts: `items` and `prompt_template`. The agent runs the prompt once per item, substituting `{item}` each time, and streams results back as they complete.

```
["TP53", "KRAS", "BRCA1"]  ×  "What is the role of {item} in cancer? Give 2 PMIDs."
        ↓                                   ↓                                ↓
   cited answer                        cited answer                    cited answer
```

## Endpoint

```
POST /apps/glkb/users/{user_id}/batch
```

## Request parameters

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

### Completion result (`status: "complete"`)

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

## Parsing the stream

```python
for line in response.iter_lines():
        if line and line.startswith(b"data:"):
                event = json.loads(line[5:])
                if event["status"] == "done":
                        print(f"{event['item']}: {event['response']}")
                elif event["status"] == "complete":
                        print(f"Done - {event['succeeded']}/{event['total']} succeeded")
```

## Throughput

At the default concurrency of 5, expect roughly 50 items per minute. Set `concurrency` higher for large lists — a batch of 1,500 genes at `concurrency=50` completes in approximately 30 minutes.