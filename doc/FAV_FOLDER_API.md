# Favorites & Folder API Reference

Base URL: `/api/v1`

All endpoints require a JWT Bearer token:
```
Authorization: Bearer <token>
```

---

## Table of Contents

1. [Bookmarked Chat Sessions](#bookmarked-chat-sessions)
2. [Bookmarked References](#bookmarked-references)
3. [Folders](#folders)
4. [Data Types](#data-types)

---

## Bookmarked Chat Sessions

### `POST /fav/chat`
Bookmark a chat history session. Idempotent — re-bookmarking the same `hid` returns the existing record.

**Request**
```json
{
  "hid": 42
}
```

**Response** `201 Created`
```json
{
  "hid": 42,
  "created_at": "2026-03-15T10:00:00Z"
}
```

**Errors**
- `404` — chat history not found or not owned by the user

---

### `DELETE /fav/chat/{hid}`
Remove a bookmark.

**Response** `204 No Content`

**Errors**
- `404` — bookmark not found

---

### `GET /fav/chat`
List all bookmarked chat sessions with their full message history, newest bookmark first.

**Response** `200 OK`
```json
{
  "sessions": [
    {
      "hid": 42,
      "leading_title": "What is BRCA1?",
      "created_at": "2026-03-15T09:00:00Z",
      "last_accessed_time": "2026-03-15T10:00:00Z",
      "messages": [
        {
          "id": 1,
          "pair_index": 0,
          "role": "user",
          "content": "What is BRCA1?",
          "references": null,
          "created_at": "2026-03-15T09:00:00Z"
        },
        {
          "id": 2,
          "pair_index": 0,
          "role": "assistant",
          "content": "BRCA1 is a tumor suppressor gene...",
          "references": [
            {
              "pmid": "38123456",
              "title": "BRCA1 and cancer risk",
              "url": "https://pubmed.ncbi.nlm.nih.gov/38123456/",
              "n_citation": 120,
              "date": "2023",
              "journal": "Nature Genetics",
              "authors": ["Smith J", "Lee K"],
              "evidence": []
            }
          ],
          "created_at": "2026-03-15T09:00:05Z"
        }
      ]
    }
  ],
  "total": 1
}
```

---

### `PATCH /fav/chat/{hid}`
Add or remove a bookmarked chat session from a folder. The chat must already be bookmarked before calling this.

**Request**
```json
{
  "folder_id": 7,
  "action": "add"
}
```
```json
{
  "folder_id": 7,
  "action": "remove"
}
```

**Response** `204 No Content`

**Errors**
- `404` — bookmark not found, folder not found, or chat not in folder (on remove)

---

## Bookmarked References

### `POST /fav/reference`
Bookmark a PubMed reference by PMID. Idempotent — re-bookmarking the same PMID returns the existing record.

**Request**
```json
{
  "pmid": "38123456",
  "ref_json": {
    "pmid": "38123456",
    "title": "BRCA1 and cancer risk",
    "url": "https://pubmed.ncbi.nlm.nih.gov/38123456/",
    "n_citation": 120,
    "date": "2023",
    "journal": "Nature Genetics",
    "authors": ["Smith J", "Lee K"],
    "evidence": []
  },
  "source_hid": 42
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `pmid` | string | ✅ | PubMed ID (max 20 chars) |
| `ref_json` | object | ✅ | Full reference object as returned by the agent |
| `source_hid` | integer | ❌ | Chat session the reference came from |

> `ref_json` is the reference object exactly as returned in the `Complete` SSE event. Pass it through directly from `event.references[i]`.

**Response** `201 Created`
```json
{
  "pmid": "38123456",
  "ref_json": { ... },
  "source_hid": 42,
  "created_at": "2026-03-15T10:00:00Z"
}
```

---

### `DELETE /fav/reference/{pmid}`
Remove a bookmarked reference.

**Response** `204 No Content`

**Errors**
- `404` — bookmark not found

---

### `GET /fav/reference`
List all bookmarked references, newest first.

**Response** `200 OK`
```json
{
  "references": [
    {
      "pmid": "38123456",
      "ref_json": {
        "pmid": "38123456",
        "title": "BRCA1 and cancer risk",
        "url": "https://pubmed.ncbi.nlm.nih.gov/38123456/",
        "n_citation": 120,
        "date": "2023",
        "journal": "Nature Genetics",
        "authors": ["Smith J", "Lee K"],
        "evidence": []
      },
      "source_hid": 42,
      "created_at": "2026-03-15T10:00:00Z"
    }
  ],
  "total": 1
}
```

---

### `PATCH /fav/reference/{pmid}`
Add or remove a bookmarked reference from a folder. The reference must already be bookmarked before calling this.

**Request**
```json
{
  "folder_id": 7,
  "action": "add"
}
```
```json
{
  "folder_id": 7,
  "action": "remove"
}
```

**Response** `204 No Content`

**Errors**
- `404` — bookmark not found, folder not found, or reference not in folder (on remove)

---

## Folders

A folder groups bookmarked chats and references. Items can belong to multiple folders (many-to-many). Deleting a folder does **not** delete the underlying bookmarks — they become unfiled.

---

### `GET /fav/folder`
List all folders for the current user with item counts, newest first.

**Response** `200 OK`
```json
{
  "folders": [
    {
      "fid": 7,
      "name": "BRCA1 Research",
      "created_at": "2026-03-15T10:00:00Z",
      "updated_at": "2026-03-15T11:00:00Z",
      "ref_count": 3,
      "chat_count": 1
    }
  ],
  "total": 1
}
```

---

### `GET /fav/folder/{fid}`
Get full folder contents: all bookmarked references and chat sessions assigned to this folder.

**Response** `200 OK`
```json
{
  "fid": 7,
  "name": "BRCA1 Research",
  "created_at": "2026-03-15T10:00:00Z",
  "updated_at": "2026-03-15T11:00:00Z",
  "ref_count": 1,
  "chat_count": 1,
  "references": [
    {
      "pmid": "38123456",
      "ref_json": { ... },
      "source_hid": 42,
      "created_at": "2026-03-15T10:00:00Z"
    }
  ],
  "sessions": [
    {
      "hid": 42,
      "leading_title": "What is BRCA1?",
      "created_at": "2026-03-15T09:00:00Z",
      "last_accessed_time": "2026-03-15T10:00:00Z",
      "messages": [ ... ]
    }
  ]
}
```

**Errors**
- `404` — folder not found or not owned by the user

---

### `POST /fav/folder`
Create a new folder.

**Request**
```json
{
  "name": "BRCA1 Research"
}
```

**Response** `201 Created`
```json
{
  "fid": 7,
  "name": "BRCA1 Research",
  "created_at": "2026-03-15T10:00:00Z",
  "updated_at": "2026-03-15T10:00:00Z",
  "ref_count": 0,
  "chat_count": 0
}
```

---

### `POST /fav/folder/{fid}/duplicate`
Duplicate a folder: creates a new folder with the same name and copies all reference and chat assignments into it. The original folder is unchanged.

**Response** `201 Created`
```json
{
  "fid": 8,
  "name": "BRCA1 Research",
  "created_at": "2026-03-15T12:00:00Z",
  "updated_at": "2026-03-15T12:00:00Z",
  "ref_count": 1,
  "chat_count": 1
}
```

**Errors**
- `404` — source folder not found

---

### `PATCH /fav/folder/{fid}`
Rename a folder.

**Request**
```json
{
  "name": "TP53 Research"
}
```

**Response** `200 OK`
```json
{
  "fid": 7,
  "name": "TP53 Research",
  "created_at": "2026-03-15T10:00:00Z",
  "updated_at": "2026-03-15T13:00:00Z",
  "ref_count": 1,
  "chat_count": 1
}
```

**Errors**
- `404` — folder not found

---

### `DELETE /fav/folder/{fid}`
Delete a folder. All chat and reference assignments inside are removed, but the underlying bookmarks are **not** deleted — they become unfiled.

**Response** `204 No Content`

**Errors**
- `404` — folder not found

---

## Data Types

### `ChatHistoryDetail`
```json
{
  "hid": 42,
  "leading_title": "What is BRCA1?",
  "created_at": "2026-03-15T09:00:00Z",
  "last_accessed_time": "2026-03-15T10:00:00Z",
  "messages": [ "<ChatMessageResponse>" ]
}
```

### `ChatMessageResponse`
```json
{
  "id": 1,
  "pair_index": 0,
  "role": "user | assistant",
  "content": "...",
  "references": null,
  "created_at": "2026-03-15T09:00:00Z"
}
```
> `references` is `null` for user messages and a list of reference objects for assistant messages.

### Reference object (`ref_json`)
The reference object is returned as-is from the agent's `Complete` SSE event. The structure from the current agent:
```json
{
  "pmid": "38123456",
  "title": "Article title",
  "url": "https://pubmed.ncbi.nlm.nih.gov/38123456/",
  "n_citation": 120,
  "date": "2023",
  "journal": "Nature Genetics",
  "authors": ["Smith J", "Lee K"],
  "evidence": []
}
```

---

## Typical Frontend Workflow

### Bookmarking a reference from a chat response
```
1. User receives Complete SSE event with references[]
2. User clicks bookmark icon on references[i]
3. POST /fav/reference  { pmid: ref.pmid, ref_json: ref, source_hid: currentHid }
```

### Adding a bookmarked item to a folder
```
1. Item must already be bookmarked (POST /fav/chat or POST /fav/reference first)
2. PATCH /fav/chat/{hid}       { folder_id: fid, action: "add" }
3. PATCH /fav/reference/{pmid} { folder_id: fid, action: "add" }
```

### Removing an item from a folder (without deleting the bookmark)
```
PATCH /fav/chat/{hid}       { folder_id: fid, action: "remove" }
PATCH /fav/reference/{pmid} { folder_id: fid, action: "remove" }
```

### Deleting a folder and all its bookmarks
```
1. GET  /fav/folder/{fid}  → get all pmids and hids
2. For each hid:  DELETE /fav/chat/{hid}
3. For each pmid: DELETE /fav/reference/{pmid}
4. DELETE /fav/folder/{fid}
```
> Or just `DELETE /fav/folder/{fid}` to remove the folder while keeping the bookmarks unfiled.
