# Tier System — Frontend Integration Guide

All endpoints are under the base URL: `https://glkb.dcmb.med.umich.edu/reorg-api/api/v1`

---

## Tiers at a Glance

| Tier | Chat + Graph calls | Quota window | Bookmarks |
|------|--------------------|--------------|-----------|
| `free` | 10 / day | Resets at **00:00 ET** every day | Blocked |
| `plus` | 200 / month | Starts when tier is assigned or renewed | Allowed |
| `pro` | 800 / month | Starts when tier is assigned or renewed | Allowed |

**"Calls"** = each request to `POST /new-llm-agent/stream` or `POST /graphs/triplet2graph`.

---

## Endpoints

### GET `/tier/me`

Returns the calling user's active tier, current quota usage, and period dates.

**Auth:** Bearer JWT required.

**Response `200`**

```json
{
  "tier": "plus",
  "period_start": "2026-02-15T10:00:00",
  "end_time": "2026-03-17T10:00:00",
  "quota_limit": 200,
  "quota_used": 47,
  "quota_remaining": 153,
  "bookmark_allowed": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `tier` | `"free"` \| `"plus"` \| `"pro"` | Effective tier right now |
| `period_start` | ISO 8601 UTC datetime | Start of the current quota window |
| `end_time` | ISO 8601 UTC datetime \| `null` | When the tier expires. `null` for free (never expires) |
| `quota_limit` | integer | Max calls allowed in the current window |
| `quota_used` | integer | Calls consumed so far in the window |
| `quota_remaining` | integer | `quota_limit − quota_used` (never negative) |
| `bookmark_allowed` | boolean | Whether the user can use bookmark features |

> **Tip:** Use `quota_remaining` to show a usage bar / warning in the UI. Use `bookmark_allowed` to conditionally render the bookmark button.

---

### PATCH `/tier/{user_id}`

Set a user's tier. Creates a new tier history entry which also resets the quota window.

**Auth:** No JWT required currently — admin guard will be added before public launch.

**Path param:** `user_id` — integer ID of the target user.

**Request body**

```json
{
  "tier": "plus",
  "end_time": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tier` | `"free"` \| `"plus"` \| `"pro"` | Yes | Target tier |
| `end_time` | ISO 8601 UTC datetime \| `null` | No | Override the expiry date. If omitted, defaults to **+30 days** for plus/pro. Ignored for free. |

**Response `200`** — same shape as `GET /tier/me`, reflecting the new tier immediately.

```json
{
  "tier": "plus",
  "period_start": "2026-03-24T14:30:00",
  "end_time": "2026-04-23T14:30:00",
  "quota_limit": 200,
  "quota_used": 0,
  "quota_remaining": 200,
  "bookmark_allowed": true
}
```

---

## Error Responses

| Status | When | Body `detail` example |
|--------|------|-----------------------|
| `401 Unauthorized` | Missing or invalid JWT on `GET /tier/me` | `"Invalid or expired token"` |
| `400 Bad Request` | Invalid `tier` value in PATCH | `"tier must be one of {'free', 'plus', 'pro'}"` |
| `429 Too Many Requests` | Quota exceeded on `/stream` or `/triplet2graph` | `"Quota exceeded: 10/10 calls used today."` |
| `403 Forbidden` | Free-tier user tries to bookmark | `"Bookmark functionality requires Plus or Pro tier."` |

---

## Quota-Counted Endpoints

These two endpoints consume 1 quota unit per authenticated call:

| Endpoint | Action counted |
|----------|---------------|
| `POST /new-llm-agent/stream` | `"chat"` |
| `POST /graphs/triplet2graph` | `"graph"` |

Both actions count against the **same shared quota pool**. A user who makes 6 chat calls and 4 graph calls has used their full 10-call free daily quota.

Unauthenticated requests to these endpoints are **not** quota-counted.

---

## Recommended UI Flows

### Show quota in the header / sidebar

```
On login or page load:
  GET /tier/me
  → store { tier, quota_remaining, quota_limit, end_time, bookmark_allowed }

Display:
  free  → "X / 10 calls left today"       (reset countdown to midnight ET)
  plus  → "X / 200 calls left this month" (expires <end_time>)
  pro   → "X / 800 calls left this month" (expires <end_time>)
```

### Handle 429 on stream / graph

```
If POST /new-llm-agent/stream  →  HTTP 429
  Show modal: "You've used all X calls for today/this month.
               Upgrade to Plus for 200 monthly calls."

Refresh quota display:
  GET /tier/me  (quota_remaining will be 0)
```

### Gate the bookmark button

```
if (!bookmark_allowed) {
  // render bookmark button as disabled with tooltip:
  // "Bookmarks are available on Plus and Pro plans"
}
```

### Tier expiry banner

```
if (tier !== "free" && end_time) {
  daysLeft = Math.ceil((new Date(end_time) - Date.now()) / 86400000)
  if (daysLeft <= 7) {
    showBanner(`Your ${tier} plan expires in ${daysLeft} day(s).`)
  }
}
```

---

## Tier Change Operations

All three operations (upgrade, downgrade, renewal) use the same `PATCH` endpoint. The difference is only in the `tier` value you send:

```
Upgrade:   { "tier": "plus" }   (free → plus)
           { "tier": "pro"  }   (free or plus → pro)

Downgrade: { "tier": "free" }   (plus or pro → free)
           { "tier": "plus" }   (pro → plus)

Renewal:   { "tier": "plus" }   (plus → plus, resets period + extends end_time)
           { "tier": "pro"  }   (pro  → pro,  resets period + extends end_time)
```

After any PATCH call, `quota_used` resets to `0` and `period_start` becomes the current timestamp.

---

## Quota Window Reference

```
free tier
  │
  ├── period_start = today 00:00 ET  (moves forward each day automatically)
  └── end_time     = null

plus / pro tier
  │
  ├── period_start = updated_at of the tier row (when PATCH was last called)
  └── end_time     = period_start + 30 days  (or the override you passed)
```

All datetimes in API responses are **naive UTC** (no `Z` or `+00:00` suffix). Treat them as UTC when parsing.
