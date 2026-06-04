# Health Check
### Verify the API is reachable before running a batch.

## Endpoint

```
GET /health
```

## Response

```json
{
	"status": "healthy",
	"timestamp": "2025-03-01T12:00:00Z"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `status` | string | `"healthy"` when the service is available |
| `timestamp` | string | ISO 8601 server time at the moment of the request |

## Code examples

```python
import requests
r = requests.get("https://api.glkb.dev/health")
print(r.json())
# {"status": "healthy", "timestamp": "2025-03-01T12:00:00Z"}
```

```bash
curl "https://api.glkb.dev/health"
```