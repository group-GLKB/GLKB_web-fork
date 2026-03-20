# Email Auth API

Base API prefix: `/api/v1`
Email auth router prefix: `/email-auth`
Full email auth prefix: `/api/v1/email-auth`

Production base URL (reverse proxy): `https://glkb.dcmb.med.umich.edu/reorg-api`
Production full prefix: `https://glkb.dcmb.med.umich.edu/reorg-api/api/v1/email-auth`

---

## Overview

The email auth module supports:

- Passwordless login via verification code
- Optional explicit registration
- Google login (returns the same JWT format as email auth)
- Profile updates (username and email change) for authenticated users

JWT tokens issued by this module use token payload type `email_auth` and are accepted by endpoints that depend on `get_current_user`.

---

## Auth Rules

Public endpoints:

- `POST /register`
- `POST /send-code`
- `POST /verify`
- `POST /google`

JWT-protected endpoints:

- `PUT /username`
- `POST /email/request-change`
- `POST /email/confirm-change`

Header format:

```http
Authorization: Bearer <token>
```

---

## Config Defaults

Current backend defaults from config:

- Verification code length: 6 digits
- Code expiration: 10 minutes
- Verify attempts max: 5
- Send-code email limit: 5 per email per hour
- Send-code IP limit: 20 per IP per hour
- JWT expiration: 7 days

---

## Endpoints

### 1) Register with email

Create an email-auth account (no password).

```http
POST /api/v1/email-auth/register
```

Request body:

```json
{
  "username": "alice",
  "email": "alice@example.com"
}
```

Response `201`:

```json
{
  "message": "User 'alice' registered successfully"
}
```

Common errors:

- `400` username already exists
- `400` email already registered

Full cURL example:

```bash
curl -X POST "https://glkb.dcmb.med.umich.edu/reorg-api/api/v1/email-auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "email": "alice@example.com"
  }'
```

---

### 2) Send verification code

Sends a one-time 6-digit code. If email does not exist, user is auto-created.

```http
POST /api/v1/email-auth/send-code
```

Request body:

```json
{
  "email": "alice@example.com"
}
```

Response `200`:

```json
{
  "message": "Verification code sent successfully",
  "expires_in": 600,
  "is_new_user": false
}
```

Common errors:

- `403` account disabled
- `429` too many requests (email or IP limits)
- `500` email sending failed

Full cURL example:

```bash
curl -X POST "https://glkb.dcmb.med.umich.edu/reorg-api/api/v1/email-auth/send-code" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com"
  }'
```

---

### 3) Verify code and login

Verifies code and returns JWT.

```http
POST /api/v1/email-auth/verify
```

Request body:

```json
{
  "email": "alice@example.com",
  "code": "123456"
}
```

Response `200`:

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "expires_in": 604800,
  "user": {
    "id": 1,
    "username": "alice",
    "email": "alice@example.com",
    "is_active": true,
    "is_verified": true,
    "created_at": "2026-03-20T12:00:00Z",
    "updated_at": "2026-03-20T12:00:00Z",
    "last_login_at": "2026-03-20T12:05:00Z"
  }
}
```

Common errors:

- `404` no verification code found
- `410` code expired
- `400` invalid code (includes remaining attempts)
- `429` too many incorrect attempts

Full cURL example:

```bash
curl -X POST "https://glkb.dcmb.med.umich.edu/reorg-api/api/v1/email-auth/verify" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "code": "123456"
  }'
```

---

### 4) Login with Google

Verifies Google ID token, logs in existing email-auth user by email, or auto-registers a new user.

```http
POST /api/v1/email-auth/google
```

Request body:

```json
{
  "credential": "<google_id_token>"
}
```

Response `200`:

Same shape as `POST /verify` (`EmailTokenResponse`).

Common errors:

- `501` Google login not configured (`GOOGLE_CLIENT_ID` missing)
- `401` invalid Google token
- `400` token missing email or email not verified
- `403` account disabled

Full cURL example:

```bash
curl -X POST "https://glkb.dcmb.med.umich.edu/reorg-api/api/v1/email-auth/google" \
  -H "Content-Type: application/json" \
  -d '{
    "credential": "<google_id_token>"
  }'
```

---

### 5) Update username (auth required)

```http
PUT /api/v1/email-auth/username
```

Headers:

```http
Authorization: Bearer <token>
```

Request body:

```json
{
  "new_username": "alice_2"
}
```

Response `200`:

```json
{
  "message": "Username updated successfully",
  "user": {
    "id": 1,
    "username": "alice_2",
    "email": "alice@example.com",
    "is_active": true,
    "is_verified": true,
    "created_at": "2026-03-20T12:00:00Z",
    "updated_at": "2026-03-20T12:10:00Z",
    "last_login_at": "2026-03-20T12:05:00Z"
  }
}
```

Common errors:

- `401` invalid or missing token
- `404` user not found
- `400` username already exists

Full cURL example:

```bash
curl -X PUT "https://glkb.dcmb.med.umich.edu/reorg-api/api/v1/email-auth/username" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "new_username": "alice_2"
  }'
```

---

### 6) Request email change (auth required)

Sends verification code to the new email.

```http
POST /api/v1/email-auth/email/request-change
```

Headers:

```http
Authorization: Bearer <token>
```

Request body:

```json
{
  "new_email": "alice.new@example.com"
}
```

Response `200`:

```json
{
  "message": "Verification code sent to new email",
  "expires_in": 600
}
```

Common errors:

- `401` invalid or missing token
- `404` user not found
- `400` new email equals current email
- `400` new email already registered
- `429` too many requests
- `500` email sending failed

Full cURL example:

```bash
curl -X POST "https://glkb.dcmb.med.umich.edu/reorg-api/api/v1/email-auth/email/request-change" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "new_email": "alice.new@example.com"
  }'
```

---

### 7) Confirm email change (auth required)

```http
POST /api/v1/email-auth/email/confirm-change
```

Headers:

```http
Authorization: Bearer <token>
```

Request body:

```json
{
  "new_email": "alice.new@example.com",
  "code": "123456"
}
```

Response `200`:

```json
{
  "message": "Email updated successfully",
  "user": {
    "id": 1,
    "username": "alice_2",
    "email": "alice.new@example.com",
    "is_active": true,
    "is_verified": true,
    "created_at": "2026-03-20T12:00:00Z",
    "updated_at": "2026-03-20T12:20:00Z",
    "last_login_at": "2026-03-20T12:05:00Z"
  }
}
```

Common errors:

- `401` invalid or missing token
- `404` user not found or no verification code found
- `410` verification code expired
- `400` invalid verification code
- `429` too many incorrect attempts
- `400` email already registered

Full cURL example:

```bash
curl -X POST "https://glkb.dcmb.med.umich.edu/reorg-api/api/v1/email-auth/email/confirm-change" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "new_email": "alice.new@example.com",
    "code": "123456"
  }'
```

---

## Typical Frontend Flow (Passwordless)

```text
1. POST /email-auth/send-code   with user email
2. User reads OTP from email
3. POST /email-auth/verify      with email + OTP
4. Store access_token
5. Use Authorization: Bearer <token> for protected APIs
```

---

## Notes

- `send-code` auto-registers unknown emails. Use `/register` only if you want explicit signup UX.
- Always treat webhook or provider events as source of truth for payment systems, but for email auth here, the source of truth is backend verification state in SQLite.
- If you need generated OpenAPI docs, run the backend and check `/docs` and `/openapi.json`.
