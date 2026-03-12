# Chat History API Reference

Base URL: `http://<host>:8001/api/v1`
All endpoints require a JWT bearer token:
```
Authorization: Bearer <token>
```

---

## Authentication

Tokens are obtained via the email OTP flow.

### Send verification code
```
POST /email-auth/send-code
```
**Request body**
```json
{ "email": "user@example.com" }
```
**Response `200`**
```json
{ "message": "Verification code sent" }
```

### Verify code and get token
```
POST /email-auth/verify
```
**Request body**
```json
{ "email": "user@example.com", "code": "123456" }
```
**Response `200`**
```json
{ "access_token": "<jwt>", "token_type": "bearer" }
```

---

## Common Types

### `ChatHistorySummary`
Returned by list, create, and update endpoints.
```json
{
  "hid": 1,
  "leading_title": "New Chat",
  "created_at": "2026-02-20T07:14:39",
  "last_accessed_time": "2026-02-20T07:17:29",
  "message_count": 4
}
```
| Field | Type | Description |
|---|---|---|
| `hid` | `int` | Chat history ID |
| `leading_title` | `string` | Session title |
| `created_at` | `datetime` | When the session was created |
| `last_accessed_time` | `datetime` | Updated on every message or access |
| `message_count` | `int` | Total number of messages (user + assistant combined) |

### `ChatMessageResponse`
Returned inside `ChatHistoryDetail.messages`.
```json
{
  "id": 1,
  "pair_index": 0,
  "role": "user",
  "content": "What is the role of BRCA1 in breast cancer?",
  "references": null,
  "created_at": "2026-02-20T07:14:45"
}
```
| Field | Type | Description |
|---|---|---|
| `id` | `int` | Message record ID |
| `pair_index` | `int` | 0-based index grouping a user+assistant exchange |
| `role` | `string` | `"user"` or `"assistant"` |
| `content` | `string` | Message text |
| `references` | `array \| null` | Articles referenced by the answer. Each item is `[title, url, n_citation, date, journal, authors]`. `null` for user messages or when no references were found. |
| `created_at` | `datetime` | When this message was saved |

Messages within a history are ordered by insertion order (user prompt always precedes its assistant answer within the same `pair_index`).

---

## Chat History CRUD

### Create chat history
```
POST /new-llm-agent/history
```
Creates an empty chat session. A title can be set now or left for auto-generation on the first `/stream` call.

**Request body**
```json
{ "leading_title": "My Session" }
```
| Field | Type | Required | Constraints |
|---|---|---|---|
| `leading_title` | `string \| null` | No | max 200 chars. Defaults to `"New Chat"` if omitted. |

**Response `201`** — `ChatHistorySummary`
```json
{
  "hid": 1,
  "leading_title": "New Chat",
  "created_at": "2026-02-20T07:14:39",
  "last_accessed_time": "2026-02-20T07:14:39",
  "message_count": 0
}
```

---

### List chat histories
```
GET /new-llm-agent/history
```
Returns the authenticated user's chat histories, newest first.

**Query parameters**
| Param | Type | Default | Constraints |
|---|---|---|---|
| `offset` | `int` | `0` | ≥ 0 |
| `limit` | `int` | `20` | 1–100 |

**Response `200`**
```json
{
  "histories": [
    {
      "hid": 2,
      "leading_title": "chat history 2",
      "created_at": "2026-02-20T07:15:59",
      "last_accessed_time": "2026-02-20T07:17:29",
      "message_count": 2
    },
    {
      "hid": 1,
      "leading_title": "chat history 1",
      "created_at": "2026-02-20T07:14:39",
      "last_accessed_time": "2026-02-20T07:17:29",
      "message_count": 4
    }
  ],
  "total": 2
}
```
| Field | Type | Description |
|---|---|---|
| `histories` | `ChatHistorySummary[]` | Paginated list, newest first |
| `total` | `int` | Total count for the user (before pagination) |

---

### Get chat history detail
```
GET /new-llm-agent/history/{hid}
```
Returns a single chat history with all messages. Also updates `last_accessed_time`.

**Path parameter:** `hid` — integer chat history ID

**Response `200`** — `ChatHistoryDetail`
```json
{
  "hid": 1,
  "leading_title": "chat history 1",
  "created_at": "2026-02-20T07:14:39",
  "last_accessed_time": "2026-02-20T07:17:29",
  "messages": [
    {
      "id": 1,
      "pair_index": 0,
      "role": "user",
      "content": "What is the role of BRCA1 in breast cancer?",
      "references": null,
      "created_at": "2026-02-20T07:14:50"
    },
    {
      "id": 2,
      "pair_index": 0,
      "role": "assistant",
      "content": "BRCA1 plays a critical role in breast cancer...",
      "references": [
        ["Article title", "https://pubmed.ncbi.nlm.nih.gov/12345678/", 42, 2023, "Nature", ["Author A", "Author B"]],
        ["Another article", "https://pubmed.ncbi.nlm.nih.gov/87654321/", 0, 2021, "Cell", []]
      ],
      "created_at": "2026-02-20T07:14:55"
    },
    {
      "id": 3,
      "pair_index": 1,
      "role": "user",
      "content": "How many articles about Alzheimer's disease were published in 2020?",
      "references": null,
      "created_at": "2026-02-20T07:15:10"
    },
    {
      "id": 4,
      "pair_index": 1,
      "role": "assistant",
      "content": "In 2020, a total of 10,758 articles related to Alzheimer's disease were published.",
      "references": null,
      "created_at": "2026-02-20T07:15:20"
    }
  ]
}
```

**Error responses**
| Status | Condition |
|---|---|
| `404` | `hid` not found or belongs to a different user |
| `401` | Missing or invalid JWT |

---

### Update chat history title
```
PATCH /new-llm-agent/history/{hid}
```

**Path parameter:** `hid` — integer chat history ID

**Request body**
```json
{ "leading_title": "BRCA1 Research" }
```
| Field | Type | Required | Constraints |
|---|---|---|---|
| `leading_title` | `string` | Yes | 1–200 chars |

**Response `200`** — `ChatHistorySummary`
```json
{
  "hid": 1,
  "leading_title": "BRCA1 Research",
  "created_at": "2026-02-20T07:14:39",
  "last_accessed_time": "2026-02-20T07:20:00",
  "message_count": 4
}
```

**Error responses**
| Status | Condition |
|---|---|
| `404` | `hid` not found or belongs to a different user |
| `422` | `leading_title` is empty or exceeds 200 chars |

---

### Delete chat history
```
DELETE /new-llm-agent/history/{hid}
```
Deletes the chat history and all its messages (cascade).

**Path parameter:** `hid` — integer chat history ID

**Response `200`**
```json
{ "message": "Chat history deleted successfully" }
```

**Error responses**
| Status | Condition |
|---|---|
| `404` | `hid` not found or belongs to a different user |

---

## Chat (with auto-save to history)

### Stream chat — SSE
```
POST /new-llm-agent/stream
```
Streams an AI response using Server-Sent Events. The prompt and answer are automatically saved to chat history after streaming completes.

**Request body**
```json
{
  "question": "What is the role of BRCA1 in breast cancer?",
  "messages": [],
  "max_articles": 5,
  "history_id": 1
}
```
| Field | Type | Required | Description |
|---|---|---|---|
| `question` | `string` | Yes | The user's question |
| `messages` | `{role, content}[]` | No | Prior conversation context (default `[]`) |
| `max_articles` | `int` | No | Articles to retrieve, 1–20 (default `5`) |
| `history_id` | `int \| null` | No | Append to existing history. If `null`, a new history is created automatically. |

**Response `200`** — `text/event-stream`

Each SSE event is a JSON object on a `data:` line:

```
data: {"step": "Planning", "message": "Analyzing question..."}

data: {"step": "Executing", "message": "Querying database..."}

data: {"step": "Complete", "response": "BRCA1 plays a critical role...", "references": [...]}

data: {"step": "Saved", "history_id": 1}
```

| `step` value | Description |
|---|---|
| `Planning` / `Executing` / `Answering` | Progress events, display as status updates |
| `Complete` | Final answer. Fields: `response` (string), `references` (array), `execution_time` (float) |
| `Saved` | Emitted after history is persisted. Field: `history_id` (int) — use this to track the session |
| `Error` | An error occurred. Fields: `error` (string), `detail` (string) |

**Reference item format** (inside `Complete.references`):
```json
["Article title", "https://pubmed.ncbi.nlm.nih.gov/12345678/", 42, 2023, "Nature", ["Author A"]]
```
Positional: `[title, url, n_citation, date, journal, authors]`

---

### Chat — non-streaming *(currently not used)*
```
POST /new-llm-agent/chat
```
Same as `/stream` but returns the full answer in one JSON response. The exchange is saved to history.

**Request body** — same as `/stream`

**Response `200`**
```json
{
  "answer": "BRCA1 plays a critical role in breast cancer...",
  "references": [],
  "conversation_id": null,
  "history_id": 1,
  "error": null
}
```
| Field | Type | Description |
|---|---|---|
| `answer` | `string` | Generated answer |
| `references` | `array` | Supporting articles (same format as stream `Complete` event) |
| `conversation_id` | `string \| null` | Agent session identifier (if applicable) |
| `history_id` | `int \| null` | Chat history ID the exchange was saved to |
| `error` | `string \| null` | Error message if something went wrong |

---

## Typical Frontend Flow

```
1.  POST /email-auth/send-code          → send OTP to user email
2.  POST /email-auth/verify             → exchange OTP for JWT token
3.  GET  /new-llm-agent/history         → load user's chat sidebar list
4.  POST /new-llm-agent/history         → create new chat session → get hid
5.  POST /new-llm-agent/stream          → stream question into hid, listen for SSE
        listen for step="Complete"      → render answer and references
        listen for step="Saved"         → confirm history_id persisted
6.  GET  /new-llm-agent/history/{hid}   → reload full conversation (on page refresh)
7.  PATCH /new-llm-agent/history/{hid}  → rename session title
8.  DELETE /new-llm-agent/history/{hid} → delete session
```
