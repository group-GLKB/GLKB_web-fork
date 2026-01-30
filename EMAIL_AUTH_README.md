# Email Verification Code Login & JWT Authentication

## Overview

This document describes the email verification code login system and how to use JWT tokens for authenticated API access.

**Authentication Flow (Simplified):**
```
Send Code (auto-register if new) -> Verify Code -> Get JWT Token -> Use Token for API Access
```

---

## API Endpoints

Base URL: `/api/v1/email-auth`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/send-code` | POST | Send verification code (auto-registers new users) |
| `/verify` | POST | Verify code and get JWT token |
| `/register` | POST | (Optional) Manually register with custom username |

---

## Step 1: Send Verification Code

Request a 6-digit verification code. **If the email is not registered, a new account will be created automatically.**

**Request:**
```bash
curl -X POST "http://localhost:8000/api/v1/email-auth/send-code" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "johndoe@example.com"
  }'
```

**Response (200 OK):**
```json
{
  "message": "Verification code sent successfully",
  "expires_in": 600,
  "is_new_user": true
}
```

**Notes:**
- `is_new_user`: `true` if a new account was created, `false` if existing user
- Username is auto-generated from email prefix (e.g., `johndoe` from `johndoe@example.com`)
- Code expires in **10 minutes** (600 seconds)
- Rate limited to **5 requests per email per hour**
- Rate limited to **10 requests per IP per hour**

**Error Responses:**
| Code | Detail |
|------|--------|
| 403 | `Account is disabled` |
| 429 | `Too many verification code requests. Please try again later.` |
| 429 | `Too many requests from this IP. Please try again later.` |
| 500 | `Failed to send verification email. Please try again.` |

---

## Step 2: Verify Code and Get JWT Token

Verify the 6-digit code received via email to complete login and get a JWT token.

**Request:**
```bash
curl -X POST "http://localhost:8000/api/v1/email-auth/verify" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "johndoe@example.com",
    "code": "123456"
  }'
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 86400,
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "johndoe@example.com",
    "is_active": true,
    "is_verified": true,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "last_login_at": "2024-01-15T10:35:00Z"
  }
}
```

**Notes:**
- JWT token expires in **24 hours** (86400 seconds)
- Maximum **5 attempts** per verification code

**Error Responses:**
| Code | Detail |
|------|--------|
| 404 | `No verification code found. Please request a new code.` |
| 410 | `Verification code has expired. Please request a new code.` |
| 429 | `Too many incorrect attempts. Please request a new code.` |
| 400 | `Invalid verification code. {N} attempts remaining.` |
| 404 | `User not found` |

---

## Using JWT Token for API Access

After obtaining the JWT token, include it in the `Authorization` header for all protected API requests.

### Header Format

```
Authorization: Bearer <your_jwt_token>
```

### curl Examples

```bash
# Set token variable
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# GET request with JWT token
curl -X GET "http://localhost:8000/api/v1/graphs/nodes" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"

# POST request with JWT token
curl -X POST "http://localhost:8000/api/v1/search/query" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "BRCA1"}'
```

### JWT Authentication Error Responses

When accessing protected routes with invalid/missing token:

| Code | Detail |
|------|--------|
| 401 | `Invalid or expired token` |
| 401 | `Invalid token payload` |
| 401 | `Invalid user ID in token` |
| 401 | `User not found` |
| 403 | `Inactive user account` |

---

## Protected Routes

The following routes require JWT authentication:

| Prefix | Description |
|--------|-------------|
| `/api/v1/graphs/*` | Graph operations |
| `/api/v1/search/*` | Search operations |

Public routes (no authentication required):

| Prefix | Description |
|--------|-------------|
| `/api/v1/auth/*` | Password-based authentication |
| `/api/v1/email-auth/*` | Email verification authentication |

---

## JWT Token Structure

The JWT token payload contains:

```json
{
  "sub": "1",           // User ID (string)
  "type": "email_auth", // Token type
  "email": "johndoe@example.com",
  "exp": 1705410600     // Expiration timestamp
}
```

---

## Configuration

Environment variables for email authentication (in `.env`):

```env
# SMTP Configuration (for sending verification emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=GLKB System
SMTP_USE_TLS=true
SMTP_USE_SSL=false

# JWT Configuration
JWT_SECRET_KEY=your-super-secret-key-change-in-production
JWT_ALGORITHM=HS256

# Email Auth Settings
EMAIL_CODE_EXPIRE_MINUTES=10
EMAIL_CODE_LENGTH=6
EMAIL_JWT_EXPIRE_HOURS=24
EMAIL_SEND_LIMIT_PER_HOUR=5
EMAIL_VERIFY_MAX_ATTEMPTS=5
EMAIL_SEND_LIMIT_PER_IP_HOUR=10
```
