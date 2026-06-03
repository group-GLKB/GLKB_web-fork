# Health Check
### Service availability and readiness guidance.

## Purpose
Use this page to track health semantics for GLKB API integrations.

## Current docs status
Detailed health endpoint contract is not published in this frontend codebase yet.

Until a dedicated contract is synced, use:

1. Batch endpoint response behavior as the runtime indicator for your workload.
2. Client-side retry and timeout guards around long-running streams.
3. Logging of `status` transitions (`done` and `complete`) to detect interrupted runs.

## Integration note
Once the backend health contract is published, this page should be updated with endpoint path, auth requirements, and response schema.