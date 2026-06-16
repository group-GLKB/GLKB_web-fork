# Drug Target Investigation
### Rapid mechanistic dossiers for a list of candidate targets.

## When to use

You have a list of drug targets, lead compounds, or approved drugs and need to rapidly assess their mechanistic evidence in a disease context — without reading hundreds of pharmacology papers.

## Example: target dossier generation for 50 candidates

A drug discovery team has narrowed a kinome screen to 50 candidate targets in metabolic disease. For each target, they need: the mechanistic rationale in the disease, known small-molecule inhibitors, human genetic evidence, and any clinical data. Normally a week of manual curation per target — with the batch endpoint, it takes 20 minutes.

## Prompt template

```python
TARGET_PROMPT = """You are a drug discovery analyst. Evaluate {item} as a therapeutic target
for Type 2 diabetes or obesity-related metabolic disease.

Search GLKB and PubMed for:
1. Mechanistic evidence linking {item} to glucose homeostasis, insulin signaling,
   or beta cell function
2. Human genetic evidence: GWAS hits, rare variant associations, Mendelian syndromes
3. Known small-molecule inhibitors or activators of {item} (any disease area)
4. Any clinical trial data for {item}-targeting agents
5. Potential liabilities: essential functions in other tissues, known toxicity signals

### {item} - Target Assessment
- **Disease mechanism:** [2 sentences]
- **Human genetics:** [evidence or "not found"]
- **Known modulators:** [drug names or "none known"]
- **Clinical stage:** [Phase X or "preclinical/none"]
- **Liabilities:** [1 sentence or "none identified"]
- **PMIDs:** [up to 3]
- **Verdict:** [Pursue / Deprioritize / Needs more data]"""
```

## Code

```python
import json, re, requests, csv, os

def extract_field(text, field):
	"""Extract a named field from the structured response block."""
	m = re.search(rf"\*\*{field}:\*\*\s*(.+?)(?=\n-|\Z)", text, re.S)
	return m.group(1).strip() if m else ""

targets = ["DYRK1A", "MAP4K4", "CSNK1E", "GRK5", ...]  # 50 kinase targets

with open("target_dossiers.csv", "w", newline="") as f:
	writer = csv.writer(f)
	writer.writerow(["target", "verdict", "mechanism", "genetics",
					 "modulators", "clinical", "liabilities", "pmids"])

	with requests.post(
		"https://api.glkb.dev/apps/glkb/users/me/batch",  # <!-- DEV: confirm URL -->
		headers={"Authorization": f"Bearer {os.environ['GLKB_API_KEY']}"},
		json={"items": targets, "prompt_template": TARGET_PROMPT, "concurrency": 10},
		stream=True,
		timeout=3600,
	) as r:
		r.raise_for_status()
		for line in r.iter_lines():
			if line and line.startswith(b"data:"):
				ev = json.loads(line[5:])
				if ev.get("status") == "done":
					resp = ev["response"]
					writer.writerow([
						ev["item"],
						extract_field(resp, "Verdict"),
						extract_field(resp, "Disease mechanism"),
						extract_field(resp, "Human genetics"),
						extract_field(resp, "Known modulators"),
						extract_field(resp, "Clinical stage"),
						extract_field(resp, "Liabilities"),
						extract_field(resp, "PMIDs"),
					])
```

## Sample output

```
target,  verdict,        mechanism,                                  clinical
DYRK1A,  Pursue,         Phosphorylates NFAT causing beta cell loss,  Phase 2 (leucettine)
MAP4K4,  Pursue,         KO protects beta cells from TNFα apoptosis,  preclinical
CSNK1E,  Deprioritize,   Ubiquitous cell-cycle kinase; no islet role, none
```

[[[glkb-info]]]Beyond kinases
The same template works for GPCR targets, epigenetic enzymes, secreted factors, or any other target class. Replace the disease context and the target list — the infrastructure is identical.
[[[/glkb-info]]]