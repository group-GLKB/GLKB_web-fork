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

**First turn (new conversation)**
```json
{
  "question": "What is the role of BRCA1 in breast cancer?",
  "max_articles": 5
}
```

**Subsequent turns (continuing conversation)**
```json
{
  "question": "Can you summarize this chat?",
  "max_articles": 5,
  "history_id": 1,
  "session_id": "stream_d28c148b"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `question` | `string` | Yes | The user's question |
| `max_articles` | `int` | No | Articles to retrieve, 1–20 (default `5`) |
| `history_id` | `int \| null` | No | Append to existing history. If `null`, a new history is created automatically. |
| `session_id` | `string \| null` | No | ADK agent session token. Omit on first turn. **Echo back the value from the `Saved` event on every subsequent turn** to maintain agent memory. |
| `messages` | `{role, content}[]` | No | Prior conversation context (default `[]`). Usually left empty — session memory is maintained server-side via `session_id`. |

**Response `200`** — `text/event-stream`

Each SSE event is a JSON object on a `data:` line:

```
data: {"step": "Processing", "content": "[TOOL CALL] article_search | ..."}

data: {"step": "Complete", "response": "BRCA1 plays a critical role...", "references": [...], "session_id": "stream_d28c148b", "done": true}

data: {"step": "Saved", "history_id": 1, "session_id": "stream_d28c148b"}
```

| `step` value | Description |
|---|---|
| `Processing` | Progress events from the agent (tool calls, reasoning). Display as status updates. |
| `Complete` | Final answer. Fields: `response` (string), `references` (array), `session_id` (string), `execution_time` (float), `done` (true) |
| `Saved` | Emitted after history is persisted (authenticated users only). Fields: `history_id` (int), `session_id` (string) — **save both for the next turn** |
| `Error` | An error occurred. Fields: `error` (string), `detail` (string, optional) |

**Reference object format** (inside `Complete.references`):
```json
{
  "pmid": "34081848",
  "title": "Adjuvant Olaparib for Patients with BRCA1- or BRCA2-Mutated Breast Cancer.",
  "url": "https://pubmed.ncbi.nlm.nih.gov/34081848/",
  "n_citation": 559,
  "date": 2021,
  "journal": "N Engl J Med",
  "authors": ["Andrew N J Tutt", "Judy E Garber"],
  "evidence": [
    { "quote": "adjuvant olaparib ... was associated with significantly longer survival", "context_type": "abstract" }
  ]
}
```

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
1.  POST /email-auth/send-code              → send OTP to user email
2.  POST /email-auth/verify                 → exchange OTP for JWT token
3.  GET  /new-llm-agent/history             → load user's chat sidebar list

Turn 1 (new conversation):
4.  POST /new-llm-agent/stream              → { question, max_articles }
        on step="Complete"                  → render answer and references
        on step="Saved"                     → store history_id and session_id

Turn 2+ (continuing conversation):
5.  POST /new-llm-agent/stream              → { question, max_articles, history_id, session_id }
        on step="Complete"                  → render answer and references
        on step="Saved"                     → update stored session_id (stays the same)

6.  GET  /new-llm-agent/history/{hid}       → reload full conversation (on page refresh)
7.  PATCH /new-llm-agent/history/{hid}      → rename session title
8.  DELETE /new-llm-agent/history/{hid}     → delete session
```

> **Key change from legacy:** The frontend no longer manages `session_id` manually. Send `null`/omit on turn 1, then echo back the `session_id` from the `Saved` event on every subsequent turn. The agent uses this to recall the full conversation context.
