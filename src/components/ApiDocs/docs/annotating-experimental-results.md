# Annotating Experimental Results
### Understand what your hits mean before deciding which ones to follow up.

## When to use

You have a list of hits from an experiment — differentially expressed genes, proteomics hits, ATAC-seq peaks near genes, co-expression module members — and need to understand what each one means biologically before committing to follow-up.

## Example: RNA-seq DEG annotation

An RNA-seq experiment comparing treated vs. untreated cells returns 800 differentially expressed genes. The batch endpoint annotates each gene in one request, returning its known function, disease associations, and whether any published perturbation study links it to the biological process under study.

## Prompt template

```python
ANNOT_PROMPT = """A gene, {item}, is differentially expressed in human pancreatic beta cells
treated with a glucolipotoxicity stress model (high glucose + high palmitate).

Search GLKB and PubMed and answer:
1. What is this gene's known function in pancreatic beta cells or islets?
2. Is it associated with Type 1 or Type 2 diabetes in human genetics studies?
3. Is upregulation or downregulation of this gene consistent with beta cell
   stress, dedifferentiation, or apoptosis?
4. Has any study shown that perturbing this gene affects beta cell survival or function?

### {item}
- **Function:** [1 sentence]
- **Diabetes association:** [Yes - evidence / No - not found]
- **Stress direction:** [Consistent with stress / Inconsistent / Unknown]
- **Perturbation evidence:** [1 sentence or "none found"]
- **PMIDs:** [up to 2]"""
```

## Code

```python
import json, requests, os

deg_genes = ["TXNIP", "DDIT3", "ATF3", "SLC2A2", ...]  # 800 DEGs
results = {}

with requests.post(
	"https://api.glkb.dev/apps/glkb/users/me/batch",  # <!-- DEV: confirm URL -->
	headers={"Authorization": f"Bearer {os.environ['GLKB_API_KEY']}"},
	json={"items": deg_genes, "prompt_template": ANNOT_PROMPT, "concurrency": 10},
	stream=True,
	timeout=7200,
) as r:
	r.raise_for_status()
	for line in r.iter_lines():
		if line and line.startswith(b"data:"):
			ev = json.loads(line[5:])
			if ev.get("status") == "done":
				results[ev["item"]] = ev["response"]

with open("deg_annotations.json", "w") as f:
	json.dump(results, f, indent=2)
```

## What you get

800 genes annotated in ~15 minutes. Known stress-response genes (TXNIP, DDIT3) score correctly; unannotated genes are explicitly marked "none found" rather than confabulated. The resulting file replaces an afternoon of manual database lookup and lets you immediately filter to the highest-priority follow-up candidates.

[[[glkb-info]]]Filter before annotating
For large DEG lists, run a lightweight triage pass first to separate genes with any diabetes/islet literature from those with none. Annotate only the former in depth — this cuts runtime by 40–60% on typical lists where half the candidates have no relevant literature.
[[[/glkb-info]]]