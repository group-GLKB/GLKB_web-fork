# Google Login Flow

## Flow Diagram

```
 Browser (Frontend)                 Google                    GLKB Backend
        │                              │                             │
        │   1. User clicks             │                             │
        │   "Sign in with Google"      │                             │
        │                              │                             │
        │──── 2. Google Sign-In ──────►│                             │
        │        popup/redirect        │                             │
        │                              │                             │
        │◄─── 3. Returns id_token ─────│                             │
        │        (JWT from Google)     │                             │
        │                              │                             │
        │──── 4. POST /api/v1/email-auth/google ──────────────────►│
        │         { credential: id_token }                          │
        │                              │                             │
        │                              │◄── 5. Verify id_token ─────│
        │                              │    (checks signature,       │
        │                              │     expiry, client_id)      │
        │                              │                             │
        │                              │──── 6. Returns email ──────►│
        │                              │         + email_verified    │
        │                              │                             │
        │                              │              7. Look up email in DB
        │                              │                ┌────────────────────┐
        │                              │                │ Found?             │
        │                              │                │  YES → log in      │
        │                              │                │  NO  → create user │
        │                              │                └────────────────────┘
        │                              │                             │
        │◄─── 8. Returns JWT ─────────────────────────────────────-─│
        │     { access_token,          │                             │
        │       token_type,            │                             │
        │       expires_in,            │                             │
        │       user }                 │                             │
        │                              │                             │
        │   9. Store JWT, use as       │                             │
        │   Bearer token on all        │                             │
        │   subsequent requests        │                             │
```

---

## Account Merging

```
User previously registered with email auth using john@gmail.com
                    │
                    ▼
User clicks "Sign in with Google" using john@gmail.com
                    │
                    ▼
Backend finds existing EmailAuthUser by email
                    │
                    ▼
Logs in as the SAME account — no duplicate created
All history, graphs, favorites preserved
```

---

## API Endpoint

### `POST /api/v1/email-auth/google`

Public — no auth required.

**Request:**
```json
{ "credential": "<google_id_token>" }
```

**Response `200`:**
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "expires_in": 604800,
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@gmail.com",
    "is_active": true,
    "is_verified": true,
    "created_at": "2026-03-17T10:00:00Z",
    "updated_at": "2026-03-17T10:00:00Z",
    "last_login_at": "2026-03-17T10:00:00Z"
  }
}
```

**Error responses:**

| Status | Reason |
|---|---|
| `401` | Invalid or expired Google token |
| `400` | Token has no email, or email not verified by Google |
| `403` | Account exists but is disabled |
| `501` | `GOOGLE_CLIENT_ID` not set on the server |

---

## JWT

The token returned is **identical** to the email auth JWT — `type: "email_auth"`. All existing authenticated endpoints (`/graphs/history`, `/fav/*`, `/files/*`, etc.) accept it without any changes.

---

## Configuration

Set in `.env`:
```
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
```

Get from: Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs
