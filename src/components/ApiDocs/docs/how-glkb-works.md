# How GLKB Works

Knowledge graph retrieval, agent reasoning, and mandatory citations.

## The knowledge graph

GLKB is built from the full PubMed corpus and encodes 263 million biomedical terms and 14.6 million relationships, including gene-disease associations, pathway memberships, protein interactions, and ontology hierarchies.

Supported entity types include genes, variants, drugs, proteins, and diseases. The graph is the agent's source of truth: it does not answer from parametric memory alone.

## How the agent works

When you submit a batch request, the agent processes each item through three steps:

1. **Retrieve**: GLKB looks up the entity in the knowledge graph and pulls its associated relationships, evidence, and PubMed IDs.
2. **Reason**: the agent interprets the retrieved context against your prompt template to produce a structured answer.
3. **Cite**: every factual claim is anchored to a specific PubMed ID from the retrieved evidence. If no supporting evidence exists, the field is left empty and labeled `none found`.

The agent never invents citations. Gaps in the literature are surfaced explicitly, not papered over.

## Citation guarantees

Citations are not optional annotations. They are part of the output contract. The agent is constrained to cite only PubMed IDs that were retrieved for that specific entity. If a claim cannot be grounded, the agent returns `none found` rather than fabricate a reference.

This means you can trust empty fields. A blank `pmids` array means no evidence exists in the graph for that claim, not that the agent missed it.

## Structured output

When your prompt template requests structured fields, for example `function`, `disease`, and `pmids`, the agent populates only the fields it can support. Unsupported fields are left empty and are never guessed or inferred beyond what the evidence allows.

This makes output directly machine-readable. You can parse the response, filter on empty fields, and build downstream pipelines without manual review for hallucinated values.

## Reproducibility

The same prompt template applied to the same item list produces consistent, comparable output across runs. There is no stochastic variation in which evidence is retrieved. The knowledge graph is deterministic at query time, making GLKB outputs suitable for reproducible research workflows.
