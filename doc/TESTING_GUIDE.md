# Email Authentication Testing Guide

## Overview
This guide provides step-by-step manual testing procedures for the email authentication system.

## Prerequisites
- Backend server running
- Access to email inbox for testing
- Browser DevTools open (F12)

---

## Test 1: Email Reception and Verification Code Delivery

**Steps:**
1. Open browser in incognito/private mode
2. Navigate to `http://localhost:3000/login`
3. Enter your real email address
4. Click "Send Code" button
5. Open your email inbox (check spam folder if needed)
6. Verify you received the 6-digit verification code

**What to Check:**
- [x] Email received within 1-2 minutes
- [x] Email contains 6-digit code
- [x] No errors in browser console (F12)

**Expected Result:** ✅ Success if email received with verification code

**Document:**
- Time tested: 1/25/2026
- Time to receive code: 5s

---

## Test 2: Correct Code Login

**Steps:**
1. Using the code from Test 1, enter all 6 digits into the input fields
2. Click "Verify" button
3. Observe the navigation

**What to Check:**
- [x] Browser navigates to `/` (home page)
- [x] No error messages

**Verify Authentication State in Console (F12):**
```javascript
localStorage.getItem('access_token')
// Result: 'eyJhbGciOiJ1zI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMyIsInR5cGUiOiJlbWFpbCIsImV4cCI6MTcwMzI2MTk5OXO.WwtD_oG8iDd24NSY2HB932mYgwQXLd_95_9974G0EsQ'

JSON.parse(localStorage.getItem('user'))
// Result: {id: 13, username: 'yangtom', email: 'yangtom@umich.edu', is_active: true, is_verified: true, ...}
```

**Check UI:**
- [ ] User info displayed in navigation bar
- [ ] Can access protected routes

**Expected Result:** ✅ Success if navigated to home with correct user state and authenticated state

---

## Test 3: Incorrect Code with Attempt Tracking

**Steps:**
1. Open new incognito window
2. Request a code for a different email
3. On verify page, enter **incorrect** 6-digit code (e.g., 999999)
4. Click "Verify" and note the error
5. Repeat with incorrect codes until attempts are exhausted

**What to Check:**
- [x] Each attempt shows "X attempts remaining"
- [x] After max attempts: "Maximum attempts reached"
- [x] Cannot login after attempts exhausted

**Critical Test - After Exhausting Attempts:**
1. Request a new code via "Resend Code" button
2. Wait for new code in email
3. Try entering the **original correct code** from before

**What to Check:**
- [x] System still fails to login with old code
- [x] Only the new code works

**Expected Result:** ✅ Success if number of attempts decreases to zero, and even with correct old code, system fails to login

**Document:**
- Max attempts allowed: 5

---

## Test 4: Expired Code (>10 Minutes)

**Steps:**
1. Open new incognito window
2. Request a verification code
3. **Wait 11 minutes** (set a timer)
4. Enter the code after 11 minutes

**What to Check:**
- [x] Code is rejected
- [x] Error message mentions "expired"
- [x] Login fails

**Expected Result:** ✅ Success if login fails after waiting >10 minutes

---

## Test 5: Email Rate Limiting (5 Requests Per Hour)

**Steps:**
1. Open browser in incognito mode
2. Use the **same email address** for all requests
3. Request code #1 - Should succeed
4. Request code #2 - Should succeed
5. Request code #3 - Should succeed
6. Request code #4 - Should succeed
7. Request code #5 - Should succeed
8. Request code #6 - **Should FAIL**

**What to Check - Requests 1-5:**
- [x] Each request succeeds
- [x] New code sent each time

**What to Check - Request 6:**
- [x] Request is blocked
- [x] Error message: "Too many requests"
- [x] HTTP status 429 (check Network tab in F12)
- [x] After one hour, the number of requests should be updated (reset to 0)

**Expected Result:** ✅ Success if 6th request with same email results in failure

**Document:**
- Successful requests: 5
- Error message: Too many verification code requests. Please try again later.
- **Status:** ✅ SOLVED

---

## Test 6: IP Rate Limiting (10 Requests Per Hour)

**Setup:**
1. Clear browser data
2. Open incognito window
3. Use **different email addresses** for each request

**Steps:**
Request codes for different emails:
1. `test1@example.com` - Should succeed
2. `test2@example.com` - Should succeed
3. `test3@example.com` - Should succeed
4. `test4@example.com` - Should succeed
5. `test5@example.com` - Should succeed
6. `test6@example.com` - Should succeed
7. `test7@example.com` - Should succeed
8. `test8@example.com` - Should succeed
9. `test9@example.com` - Should succeed
10. `test10@example.com` - Should succeed
11. `test11@example.com` - **Should FAIL**

**What to Check - Requests 1-10:**
- [x] All requests succeed

**What to Check - Request 11:**
- [x] Blocked with 429 error
- [x] Error indicates IP rate limit
- [x] Cannot proceed regardless of email
- [x] After one hour, the number of requests should be updated (reset to 0)

**Expected Result:** ✅ Success if 11th request per IP in an hour results in failure

**Document:**
- Successful requests: 10
- Error message: Too many verification code requests. Please try again later.
- **Status:** ✅ SOLVED

---
