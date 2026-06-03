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

The example below runs the GLKB batch endpoint and asks for a two-sentence literature summary with citations.

```python
import os
import json
import requests

BASE_URL = "https://api.glkb.org"
API_KEY = os.getenv("GLKB_API_KEY")

ITEMS = ["TP53", "KRAS", "BRCA1", "EGFR", "MYC"]
PROMPT = "In 2 sentences, what is the role of {item} in cancer? Give up to 2 PMIDs."

with requests.post(
	f"{BASE_URL}/api/batch",
	headers={
		"Authorization": f"Bearer {API_KEY}",
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
		if not line:
			continue
		event = json.loads(line)
		print(event)
```

The API responds as a stream. Results arrive item-by-item as each item finishes.

| Field | Description |
| --- | --- |
| `item` | The gene (or whatever input item you passed in) |
| `response` | The agent's cited answer |
| `status` | `"done"` per result, `"complete"` when the full batch finishes |

You should see output like this appearing gene by gene:

```text
{"item":"KRAS","response":"KRAS is one of the most commonly mutated oncogenes...","status":"done"}
{"item":"TP53","response":"TP53 encodes a tumor suppressor...","status":"done"}
...
{"event":"complete","succeeded":5,"total":5}
```
