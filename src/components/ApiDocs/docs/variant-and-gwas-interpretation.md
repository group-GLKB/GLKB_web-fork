# Variant & GWAS Interpretation
### Prioritize candidate causal genes at GWAS loci with literature evidence.

## When to use

You have a list of variants from a GWAS, whole-exome/genome sequencing, or fine-mapping analysis and need to prioritize which genes are most likely functional and disease-relevant before investing in experimental follow-up.

## Example: GWAS fine-mapping prioritization

A T2D GWAS identifies 200 fine-mapped loci. For each credible set gene, the question is: does the literature support a functional mechanism linking this gene to beta cell biology or glucose homeostasis? Manual curation at 200 genes takes weeks; the batch endpoint returns a prioritized list with citations in under an hour.

## Prompt template

```python
GWAS_PROMPT = """Evaluate the gene {item} as a candidate causal gene at a Type 2 diabetes GWAS locus.

Search GLKB and PubMed for:
1. Any published functional evidence linking {item} to beta cell biology, insulin
   secretion, insulin resistance, or glucose homeostasis
2. Human genetic evidence beyond GWAS: rare coding variants, eQTL colocalisation,
   Mendelian phenotypes
3. Mouse or cell-line KO/KD phenotypes relevant to diabetes
4. Expression: is {item} expressed in human islets, liver, or muscle?

### {item}
- **Functional evidence:** [1-2 sentences or "none found"]
- **Genetic evidence beyond GWAS:** [evidence or "none found"]
- **Model organism phenotype:** [phenotype or "none found"]
- **Islet expression:** [Yes / No / Unknown]
- **Priority:** [High / Medium / Low]
- **PMIDs:** [up to 3]"""
```

## Code

```python
import json, re, requests, pandas as pd, os

def extract_field(text, field):
	m = re.search(rf"\*\*{field}:\*\*\s*(.+?)(?=\n-|\Z)", text, re.S)
	return m.group(1).strip() if m else ""

locus_genes = ["TCF7L2", "KCNJ11", "SLC30A8", "CDKAL1", ...]  # 200 GWAS genes
records = []

with requests.post(
	"https://api.glkb.dev/apps/glkb/users/me/batch",  # <!-- DEV: confirm URL -->
	headers={"Authorization": f"Bearer {os.environ['GLKB_API_KEY']}"},
	json={"items": locus_genes, "prompt_template": GWAS_PROMPT, "concurrency": 10},
	stream=True,
	timeout=7200,
) as r:
	r.raise_for_status()
	for line in r.iter_lines():
		if line and line.startswith(b"data:"):
			ev = json.loads(line[5:])
			if ev.get("status") == "done":
				records.append({
					"gene":     ev["item"],
					"priority": extract_field(ev["response"], "Priority"),
					"summary":  extract_field(ev["response"], "Functional evidence"),
					"pmids":    extract_field(ev["response"], "PMIDs"),
				})

df = pd.DataFrame(records)
df[df["priority"] == "High"].to_csv("high_priority_loci.csv", index=False)
```

## Sample output

```
gene,     priority,  summary,                                          pmids
TCF7L2,   High,      Regulates Wnt signaling in beta cell survival,    12345678 23456789
KCNJ11,   High,      Encodes Kir6.2 subunit of KATP channel in islets, 34567890
CDKAL1,   Medium,    tRNA modification role; indirect islet evidence,  none found
```

A T2D GWAS identifies 200 fine-mapped loci. For each credible set gene, the question is: does the literature support a functional mechanism linking this gene to beta cell biology or glucose homeostasis? Manual curation at 200 genes takes weeks; the batch endpoint returns a prioritized list with citations in under an hour.

[[[glkb-info]]]Extending to rare variants
Replace locus gene names with GENE:p.VAR strings and ask the agent to retrieve functional domain context, known pathogenic variants at the same residue, and ClinVar classifications. The same prompt structure applies.
[[[/glkb-info]]]