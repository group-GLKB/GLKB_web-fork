# Graph History API

Base path: `/api/v1/graphs/history`
All endpoints require JWT authentication (`Authorization: Bearer <token>`).

---

## Data Model

| Field | Type | Description |
|---|---|---|
| `ghid` | integer | Unique graph history ID |
| `title` | string | Display name (user-defined or auto-generated) |
| `endpoint_type` | string | Which graph endpoint produced this snapshot (see values below) |
| `graph_snapshot` | array | Normalized node list — `[{id, name, type}, ...]` |
| `created_at` | datetime | When the graph was saved |
| `last_accessed_time` | datetime | Updated each time the graph is loaded |

### `endpoint_type` values

| Value | Source endpoint | Description |
|---|---|---|
| `term_graph` | `GET /graphs/term-graph` | Graph generated from search terms |
| `triplet2graph` | `POST /graphs/triplet2graph` | Graph generated from entity triplets |
| `neighbor_graph` | `GET /graphs/neighbor-graph` | Neighbor graph for a single entity |
| `add_nodes` | `GET /graphs/add-nodes` | Graph after adding nodes to an existing graph |
| `ent2art_graph` | `POST /graphs/ent2art-graph` | Entity graph converted to article graph |

---

## Endpoints

### List saved graphs

```
GET /api/v1/graphs/history
```

Query parameters:

| Param | Type | Default | Description |
|---|---|---|---|
| `offset` | integer | `0` | Pagination offset |
| `limit` | integer | `20` | Max results (1–100) |

Response `200`:
```json
{
  "histories": [
    {
      "ghid": 1,
      "title": "HNF4A neighbor graph",
      "endpoint_type": "neighbor_graph",
      "created_at": "2026-03-17T10:00:00Z",
      "last_accessed_time": "2026-03-17T10:05:00Z"
    }
  ],
  "total": 1
}
```

---

### Save a graph snapshot

Called when the user hits save after generating or modifying a graph.
Each save always creates a **new entry** — modifications (add/delete nodes) are new history entries.

```
POST /api/v1/graphs/history
```

Request body:
```json
{
  "title": "HNF4A neighbor graph",
  "endpoint_type": "neighbor_graph",
  "graph_snapshot": [
    { "id": "hgnc:5024", "name": "HNF4A", "type": "Gene" },
    { "id": "hgnc:11270", "name": "SPRY2", "type": "Gene" }
  ]
}
```

Response `201`:
```json
{
  "ghid": 1,
  "title": "HNF4A neighbor graph",
  "endpoint_type": "neighbor_graph",
  "created_at": "2026-03-17T10:00:00Z",
  "last_accessed_time": "2026-03-17T10:00:00Z",
  "graph_snapshot": [
    { "id": "hgnc:5024", "name": "HNF4A", "type": "Gene" },
    { "id": "hgnc:11270", "name": "SPRY2", "type": "Gene" }
  ]
}
```

---

### Load a saved graph

Called when the user clicks a history entry. The `graph_snapshot` is a normalized node list. The frontend is responsible for re-fetching edges if needed for rendering.

```
GET /api/v1/graphs/history/{ghid}
```

Response `200`:
```json
{
  "ghid": 1,
  "title": "HNF4A neighbor graph",
  "endpoint_type": "neighbor_graph",
  "created_at": "2026-03-17T10:00:00Z",
  "last_accessed_time": "2026-03-17T10:10:00Z",
  "graph_snapshot": [
    { "id": "hgnc:5024", "name": "HNF4A", "type": "Gene" },
    { "id": "hgnc:11270", "name": "SPRY2", "type": "Gene" }
  ]
}
```

Response `404` if `ghid` not found or belongs to another user.

---

### Rename a graph

```
PATCH /api/v1/graphs/history/{ghid}
```

Request body:
```json
{ "title": "HNF4A – SPRY2 pathway" }
```

Response `200`: updated `GraphHistorySummary` (no `graph_snapshot`).

---

### Delete a graph

```
DELETE /api/v1/graphs/history/{ghid}
```

Response `200`:
```json
{ "message": "Graph history deleted successfully" }
```

---

## Bookmark & Folder Endpoints

Graph history entries can be bookmarked and organized into folders via the `/fav` routes. Bookmarking must happen before folder assignment.

### Bookmark a graph

```
POST /api/v1/fav/graph
```

Request body:
```json
{ "ghid": 1 }
```

Response `201`:
```json
{ "ghid": 1, "created_at": "2026-03-17T10:00:00Z" }
```

---

### Remove bookmark

```
DELETE /api/v1/fav/graph/{ghid}
```

Response `204` (no body).

---

### List bookmarked graphs

```
GET /api/v1/fav/graph
```

Response `200`:
```json
{
  "graphs": [
    {
      "ghid": 1,
      "title": "HNF4A neighbor graph",
      "endpoint_type": "neighbor_graph",
      "created_at": "2026-03-17T10:00:00Z",
      "last_accessed_time": "2026-03-17T10:05:00Z"
    }
  ],
  "total": 1
}
```

> Returns `GraphHistorySummary` only — no `graph_snapshot`. Call `GET /graphs/history/{ghid}` to load the full snapshot.

---

### Add / remove from a folder

```
PATCH /api/v1/fav/graph/{ghid}
```

Request body:
```json
{ "folder_id": 1, "action": "add" }
```

or

```json
{ "folder_id": 1, "action": "remove" }
```

Response `204` (no body).

> The graph must be bookmarked first. Deleting a folder unfiled the graph but does not remove the bookmark.

---

## Typical frontend flow

```
1. User generates a graph
      ↓
   [graph data already in frontend state]

2. User modifies graph (add / delete nodes) and hits save
      ↓
   POST /graphs/history  { title, endpoint_type, graph_snapshot: [{id, name, type}, ...] }
      ↓
   Store returned ghid  (only nodes are saved — edges are cheap to re-fetch)

3. Sidebar: load history list on mount
      ↓
   GET /graphs/history?limit=20

4. User clicks a history entry
      ↓
   GET /graphs/history/{ghid}
      ↓
   graph_snapshot contains [{id, name, type}, ...] node list
   Frontend re-fetches edges (e.g. via the graph endpoint) to render

5. User renames entry inline
      ↓
   PATCH /graphs/history/{ghid}  { title: "new name" }

6. User deletes entry
      ↓
   DELETE /graphs/history/{ghid}

7. User bookmarks a graph
      ↓
   POST /fav/graph  { ghid }

8. User adds bookmarked graph to a folder
      ↓
   PATCH /fav/graph/{ghid}  { folder_id, action: "add" }

9. User removes graph from folder (bookmark kept)
      ↓
   PATCH /fav/graph/{ghid}  { folder_id, action: "remove" }

10. User removes bookmark entirely
      ↓
   DELETE /fav/graph/{ghid}
```
