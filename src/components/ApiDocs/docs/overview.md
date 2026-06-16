# Get Started with GLKB

Make your first API call with the GLKB API.

## Prerequisites

You need a GLKB account. If you do not have one yet, sign up through the GLKB dashboard.

## Get your API keys

Log in to the GLKB dashboard and navigate to API > API Keys.

Store it as an environment variable:

```bash
export GLKB_API_KEY="your-api-key-here"
```

## Your first call

The example below runs the GLKB agent across five cancer genes and asks for a two-sentence literature summary with citations. This uses the requests library. Install it with pip install requests if you don't have it.

```python
import json
import os
import requests

BASE_URL = "https://api.glkb.dev"  # <!-- DEV: replace with production base URL -->
API_KEY  = os.environ["GLKB_API_KEY"]

ITEMS  = ["TP53", "KRAS", "BRCA1", "EGFR", "MYC"]
PROMPT = "In 2 sentences, what is the role of {item} in cancer? Give up to 2 PMIDs."

with requests.post(
    f"{BASE_URL}/apps/glkb/users/me/batch",  # <!-- DEV: confirm URL structure -->
    headers={
        "Authorization": f"Bearer {API_KEY}",  # <!-- DEV: confirm header name/format -->
        "Content-Type": "application/json",
    },
    json={
        "items": ITEMS,
        "prompt_template": PROMPT,
        "concurrency": 5,
    },
    stream=True,
    timeout=300,
) as response:
    response.raise_for_status()
    for line in response.iter_lines():
        if line and line.startswith(b"data:"):
            event = json.loads(line[5:])
            if event.get("status") == "done":
                print(f"{event['item']}: {event['response']}")
            elif event.get("status") == "complete":
                print(f"\nDone — {event['succeeded']}/{event['total']} succeeded")
```

The API responds as a stream. Results arrive item-by-item as each item finishes.

| Field | Description |
| --- | --- |
| `item` | The gene (or whatever input item you passed in) |
| `response` | The agent's cited answer |
| `status` | `"done"` per result, `"complete"` when the full batch finishes |

You should see output like this appearing gene by gene:

```
{"item":"KRAS","response":"KRAS is one of the most commonly mutated oncogenes...","status":"done"}
{"item":"TP53","response":"TP53 encodes a tumor suppressor...","status":"done"}
...
{"event":"complete","succeeded":5,"total":5}
```
