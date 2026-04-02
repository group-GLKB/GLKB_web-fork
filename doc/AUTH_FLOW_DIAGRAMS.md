# Authentication Flow Diagrams - GLKB Frontend

Email-based passwordless authentication with auto-registration.

---

## System Overview

**Authentication Method:** Email Verification Code (Passwordless)  
**Backend API:** `/api/v1/email-auth/*`

**How it works:**
1. User enters email → Backend sends 6-digit verification code
2. New users are automatically registered on first sign-in
3. User enters code → Backend returns JWT token
4. Token stored in localStorage for authenticated requests

---

## 1. Email Authentication Flow (Step 1: Send Code)

**No separate signup needed - users are auto-registered on first login!**

```
┌─────────────┐
│   Browser   │
│ /login      │
└──────┬──────┘
       │ User enters email:
       │ "sarah@yahoo.com"
       │
       │ Clicks "Continue"
       ▼
┌─────────────────────────────────────┐
│ LoginPage Component                 │
│ calls: sendCode(email)              │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ service/Auth.jsx                    │
│ sendVerificationCode() function     │
└──────┬──────────────────────────────┘
       │
       │ POST /api/v1/email-auth/send-code
       │ { "email": "sarah@yahoo.com" }
       ▼
┌─────────────────────────────────────────────┐
│ Backend (Python/FastAPI)                    │
│ 1. Check if email exists in database        │
│    - If NEW: Auto-create user record        │
│    - If EXISTS: Get existing user           │
│ 2. Generate 6-digit code (123456)           │
│ 3. Store code in cache (expires 10 min)     │
│ 4. Send email with verification code        │
│ 5. Return success + user status             │
└──────┬──────────────────────────────────────┘
       │
       │ Response:
       │ {
       │   "message": "Verification code sent",
       │   "is_new_user": true,  ← Auto-registered!
       │   "expires_in": 600
       │ }
       ▼
┌─────────────────────────────────────┐
│ LoginPage Component                 │
│ - Navigate to /verify-code          │
│ - Pass email in state               │
└─────────────────────────────────────┘

┌────────────────────────────────────────┐
│ User's Email Inbox                     │
├────────────────────────────────────────┤
│ Subject: Your GLKB Verification Code   │
│                                        │
│ Your code is: 123456                   │
│ Valid for 10 minutes                   │
└────────────────────────────────────────┘
```

---

## 2. Email Authentication Flow (Step 2: Verify Code & Login)

```
┌─────────────┐
│   Browser   │
│ /verify-code│
└──────┬──────┘
       │ User enters code from email:
       │ "123456"
       │
       │ Clicks "Verify"
       ▼
┌─────────────────────────────────────┐
│ VerifyCodePage Component            │
│ calls: verifyCode(email, code)      │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ service/Auth.jsx                    │
│ verifyCode() function               │
└──────┬──────────────────────────────┘
       │
       │ POST /api/v1/email-auth/verify
       │ { "email": "sarah@yahoo.com", "code": "123456" }
       ▼
┌─────────────────────────────────────────────┐
│ Backend (Python/FastAPI)                    │
│ 1. Check code in cache                      │
│ 2. Verify code matches & not expired        │
│ 3. Get user from database by email          │
│ 4. Create JWT token with user info          │
│    JWT contains: { user_id: 1, exp: ... }   │
│ 5. Delete used code from cache              │
│ 6. Return token + user data                 │
└──────┬──────────────────────────────────────┘
       │
       │ Response:
       │ {
       │   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
       │   "token_type": "bearer",
       │   "user": { 
       │     "id": 1, 
       │     "email": "sarah@yahoo.com",
       │     "username": "sarah_yahoo_com"  ← auto-generated
       │   }
       │ }
       ▼
┌─────────────────────────────────────────────┐
│ service/Auth.jsx                            │
│ verifyCode() stores in localStorage:        │
│ ✓ localStorage.setItem('access_token', ...) │
│ ✓ localStorage.setItem('token_type', ...)   │
│ ✓ localStorage.setItem('user', ...)         │
└──────┬──────────────────────────────────────┘
       │
       │ Returns: { success: true, user: {...} }
       ▼
┌─────────────────────────────────────┐
│ VerifyCodePage Component            │
│ - Update AuthContext state          │
│ - Redirect to homepage (/)          │
└─────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ localStorage (Browser Storage)             │
├────────────────────────────────────────────┤
│ access_token: "eyJhbGciOiJIUzI1NiIs..."     │
│ token_type: "bearer"                       │
│ user: '{"id":1,"email":"sarah@yahoo.com"}' │
└────────────────────────────────────────────┘
        ↑
        │ Persists even after browser refresh!
