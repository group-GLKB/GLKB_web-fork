# Authentication Flow Diagrams - GLKB Frontend

Essential guide to JWT-based authentication system.

---

## System Overview

**Authentication Method:** JWT (JSON Web Token)  
**Storage:** localStorage (browser)  
**Transport:** axios with automatic interceptor  
**Backend API:** `/api/v1/auth/*`

**Two Essential Files:**
1. `service/Auth.jsx` - API calls (signup, login, logout)
2. `utils/axiosConfig.js` - **Automatically adds JWT token to ALL requests** ⭐

---

## 1. User Signup Flow

```
┌─────────────┐
│   Browser   │
│ /signup     │
└──────┬──────┘
       │ User fills form:
       │ - username: "john"
       │ - email: "john@example.com"
       │ - password: "password123"
       │
       │ Clicks "Sign Up"
       ▼
┌─────────────────────────────────────┐
│ SignupPage Component                │
│ calls: signup(username, email, pwd) │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ service/Auth.jsx                    │
│ signup() function                   │
└──────┬──────────────────────────────┘
       │
       │ POST /api/v1/auth/signup
       │ { username, email, password }
       ▼
┌─────────────────────────────────────┐
│ Backend (Python/FastAPI)            │
│ - Hash password                     │
│ - Insert into database              │
│ - Return success                    │
└──────┬──────────────────────────────┘
       │
       │ Response:
       │ { "message": "User created successfully" }
       ▼
┌─────────────────────────────────────┐
│ Frontend                            │
│ - Show success message              │
│ - Redirect to /login (2 seconds)    │
└─────────────────────────────────────┘
```

---

## 2. User Login Flow

```
┌─────────────┐
│   Browser   │
│ /login      │
└──────┬──────┘
       │ User enters:
       │ - username: "john"
       │ - password: "password123"
       │
       │ Clicks "Login"
       ▼
┌─────────────────────────────────────┐
│ LoginPage Component                 │
│ calls: login(username, password)    │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ service/Auth.jsx                    │
│ login() function                    │
└──────┬──────────────────────────────┘
       │
       │ POST /api/v1/auth/login
       │ { username: "john", password: "password123" }
       ▼
┌─────────────────────────────────────────────┐
│ Backend (Python/FastAPI)                    │
│ 1. Query database for username              │
│ 2. Verify password hash matches             │
│ 3. Create JWT token with user info          │
│    JWT contains: { user_id: 1, exp: ... }   │
│ 4. Return token + user data                 │
└──────┬──────────────────────────────────────┘
       │
       │ Response:
       │ {
       │   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
       │   "token_type": "bearer",
       │   "user": { id: 1, username: "john", email: "..." }
       │ }
       ▼
┌─────────────────────────────────────────────┐
│ service/Auth.jsx                            │
│ login() function stores in localStorage:    │
│ ✓ localStorage.setItem('access_token', ...) │
│ ✓ localStorage.setItem('token_type', ...)   │
│ ✓ localStorage.setItem('user', ...)         │
└──────┬──────────────────────────────────────┘
       │
       │ Returns: { success: true, user: {...} }
       ▼
┌─────────────────────────────────────┐
│ LoginPage Component                 │
│ - Redirect to homepage (/)          │
└─────────────────────────────────────┘

┌────────────────────────────────────────┐
│ localStorage (Browser Storage)         │
├────────────────────────────────────────┤
│ access_token: "eyJhbGciOiJIUzI1NiIs..." │
│ token_type: "bearer"                   │
│ user: '{"id":1,"username":"john",...}' │
└────────────────────────────────────────┘
        ↑
        │ Persists even after browser refresh!
```

---

## 3. Making Authenticated API Requests

**This is where `utils/axiosConfig.js` does the magic!**

```
┌─────────────────────────────────────┐
│ User browses app                    │
│ Clicks "Search Knowledge Graph"     │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│ Any Component (e.g., HomePage)              │
│ Makes API call:                             │
│ axios.get('/api/v1/knowledge/search?q=...')  │
└──────┬──────────────────────────────────────┘
       │
       │ Request BEFORE interceptor:
       │ GET /api/v1/knowledge/search
       │ Headers: { }  ← NO AUTHORIZATION YET
       ▼
┌─────────────────────────────────────────────┐
│ utils/axiosConfig.js                        │
│ REQUEST INTERCEPTOR runs:                   │
│ 1. Get token from localStorage              │
│ 2. Add to headers                           │
└──────┬──────────────────────────────────────┘
       │
       │ Request AFTER interceptor:
       │ GET /api/v1/knowledge/search
       │ Headers: {
       │   Authorization: "bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
       │ }
       ▼
┌─────────────────────────────────────────────┐
│ Backend (Python/FastAPI)                    │
│ 1. Extract Authorization header             │
│ 2. Decode JWT token                         │
│ 3. Verify signature (not tampered)          │
│ 4. Check expiration (not expired)           │
│ 5. Extract user_id from token               │
│ 6. Process request with user context        │
│ 7. Return data                              │
└──────┬──────────────────────────────────────┘
       │
       │ Response:
       │ Status: 200 OK
       │ Body: { results: [...] }
       ▼
┌─────────────────────────────────────────────┐
│ utils/axiosConfig.js                        │
│ RESPONSE INTERCEPTOR runs:                  │
│ - Status 200? Pass through ✓                │
└──────┬──────────────────────────────────────┘
       │
       │ Data returned to component
       ▼
┌─────────────────────────────────────────────┐
│ Component displays results                  │
└─────────────────────────────────────────────┘
```

**Key Point:** Developer writes `axios.get(...)`, interceptor automatically adds the Authorization header!

---

## 4. Token Expiration / 401 Error Flow

```
┌─────────────────────────────────────┐
│ User makes request                  │
│ (token expired or invalid)          │
└──────┬──────────────────────────────┘
       │
       │ axios.get('/api/v1/some-endpoint')
       ▼
┌─────────────────────────────────────────────┐
│ utils/axiosConfig.js                        │
│ REQUEST INTERCEPTOR:                        │
│ Adds expired token to headers              │
└──────┬──────────────────────────────────────┘
       │
       │ GET /api/v1/some-endpoint
       │ Authorization: bearer <expired_token>
       ▼
┌─────────────────────────────────────────────┐
│ Backend                                     │
│ 1. Decode JWT                               │
│ 2. Check expiration → EXPIRED!              │
│ 3. Return 401 Unauthorized                  │
└──────┬──────────────────────────────────────┘
       │
       │ Response:
       │ Status: 401 Unauthorized
       │ Body: { "detail": "Token expired" }
       ▼
┌─────────────────────────────────────────────┐
│ utils/axiosConfig.js                        │
│ RESPONSE INTERCEPTOR:                       │
│ if (error.response.status === 401) {        │
│   localStorage.removeItem('access_token')   │
│   localStorage.removeItem('token_type')     │
│   localStorage.removeItem('user')           │
│   window.location.href = '/login'           │
│ }                                           │
└──────┬──────────────────────────────────────┘
       │
       │ All auth data cleared!
       ▼
┌─────────────────────────────────────┐
│ Browser redirected to /login        │
│ User must login again               │
└─────────────────────────────────────┘

┌────────────────────────────────────────┐
│ localStorage (NOW EMPTY)               │
├────────────────────────────────────────┤
│ access_token: (removed)                │
│ token_type: (removed)                  │
│ user: (removed)                        │
└────────────────────────────────────────┘
```

**Key Point:** 401 errors automatically log user out and redirect to login!

---

## 5. Logout Flow

```
┌─────────────────────────────────────┐
│ User clicks "Logout" button         │
│ (in NavBar - you'll add this)       │
└──────┬──────────────────────────────┘
       │
       │ calls: logout()
       ▼
┌─────────────────────────────────────┐
│ service/Auth.jsx                    │
│ logout() function                   │
└──────┬──────────────────────────────┘
       │
       │ POST /api/v1/auth/logout
       ▼
┌─────────────────────────────────────┐
│ Backend                             │
│ Returns: { "message": "Logged out" }│
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│ service/Auth.jsx                            │
│ logout() function clears localStorage:      │
│ ✓ localStorage.removeItem('access_token')   │
│ ✓ localStorage.removeItem('token_type')     │
│ ✓ localStorage.removeItem('user')           │
└──────┬──────────────────────────────────────┘
       │
       │ Returns: { success: true }
       ▼
┌─────────────────────────────────────┐
│ Component redirects to /login       │
└─────────────────────────────────────┘
```

---

## The Two Essential Files Explained

### 1. `service/Auth.jsx` - API Communication Layer

**Purpose:** Handles all authentication API calls to backend

**What it does:**
- `signup(username, email, password)` → POST to `/api/v1/auth/signup`
- `login(username, password)` → POST to `/api/v1/auth/login` + stores JWT in localStorage
- `logout()` → POST to `/api/v1/auth/logout` + clears localStorage

**Key behavior:**
```javascript
// Login stores 3 items in localStorage:
localStorage.setItem('access_token', token);  // JWT token
localStorage.setItem('token_type', 'bearer');
localStorage.setItem('user', JSON.stringify(user));
```

---

### 2. `utils/axiosConfig.js` - Automatic Token Injector ⭐

**Purpose:** Automatically adds JWT token to EVERY axios request

**REQUEST Interceptor (runs BEFORE each request):**
```javascript
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `bearer ${token}`;
  }
  return config;
});
```

**What this means:**
- You write: `axios.get('/api/v1/knowledge/search')`
- Interceptor transforms to: `axios.get('/api/v1/knowledge/search', { headers: { Authorization: 'bearer <token>' } })`
- **No manual token management needed!**

**RESPONSE Interceptor (runs AFTER each response):**
```javascript
axios.interceptors.response.use(
  (response) => response,  // Success: pass through
  (error) => {
    if (error.response?.status === 401) {
      // Token expired/invalid → auto-logout
      localStorage.removeItem('access_token');
      localStorage.removeItem('token_type');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

**What this means:**
- Any 401 error → Automatic logout and redirect to login
- Handles expired tokens globally

---

## How to Test Auth.jsx Functions (Frontend Only)

### Browser Console Testing

**Prerequisites:**
1. Backend server running (assume it works correctly)
2. React app running with Auth.jsx loaded
3. Open browser DevTools (F12) → Console tab

**Important:** We're testing YOUR frontend code (Auth.jsx), not the backend!

---

### **Setup: Access Auth Functions**

First, make Auth functions available in console:

```javascript
// Temporarily expose Auth functions globally for testing
// Add this to index.js or run in console:
import * as Auth from './service/Auth.jsx';
window.Auth = Auth;

// Or in console, if Auth is already imported somewhere:
// Now you can use: Auth.login(), Auth.signup(), etc.
```

---

### **Test 1: Signup Function**

**What you're testing:**
- ✅ Calls correct endpoint: `/api/v1/auth/signup`
- ✅ Sends correct data format
- ✅ Handles success response
- ✅ Handles error response

```javascript
// Test successful signup (assuming backend accepts it)
const result1 = await Auth.signup('testuser1', 'test1@example.com', 'password123');
console.log('Result:', result1);

// Expected frontend behavior:
// - Console shows: 🔵 [SIGNUP] Starting signup request...
// - Console shows: ✅ [SIGNUP] Success
// - result1.success === true
// - result1.message exists

// Test error handling (duplicate username)
const result2 = await Auth.signup('testuser1', 'test2@example.com', 'password123');
console.log('Result:', result2);

// Expected frontend behavior:
// - Console shows: ❌ [SIGNUP] Failed
// - result2.success === false
// - result2.message contains error description
```

**Frontend checklist:**
- [ ] Correct API endpoint called (`/api/v1/auth/signup`)
- [ ] Request body formatted correctly
- [ ] Success case returns `{ success: true, message: '...' }`
- [ ] Error case returns `{ success: false, message: '...' }`
- [ ] Console logs show request lifecycle

---

### **Test 2: Login Function**

**What you're testing:**
- ✅ Calls correct endpoint: `/api/v1/auth/login`
- ✅ Stores token in localStorage
- ✅ Stores user data in localStorage
- ✅ Returns user object
- ✅ Handles wrong credentials

```javascript
// Test successful login
const loginResult = await Auth.login('testuser1', 'password123');
console.log('Login result:', loginResult);

// Verify YOUR frontend code did its job:
console.log('✓ Token stored?', !!localStorage.getItem('access_token'));
console.log('✓ Token type stored?', localStorage.getItem('token_type') === 'bearer');
console.log('✓ User stored?', !!localStorage.getItem('user'));
console.log('✓ User object:', JSON.parse(localStorage.getItem('user')));

// Expected frontend behavior:
// - Console shows: 🔵 [LOGIN] Starting login request...
// - Console shows: ✅ [LOGIN] Success
// - Console shows: 💾 [LOGIN] Token stored in localStorage
// - loginResult.success === true
// - loginResult.user object exists
// - loginResult.token exists

// Test wrong password
const failResult = await Auth.login('testuser1', 'wrongpassword');
console.log('Failed login result:', failResult);

// Verify error handling:
console.log('✓ No token stored?', !localStorage.getItem('access_token'));

// Expected frontend behavior:
// - Console shows: ❌ [LOGIN] Failed
// - failResult.success === false
// - failResult.message contains error
// - NO data stored in localStorage
```

**Frontend checklist:**
- [ ] Correct API endpoint called (`/api/v1/auth/login`)
- [ ] Success: token stored in `localStorage.getItem('access_token')`
- [ ] Success: user stored in `localStorage.getItem('user')`
- [ ] Success: returns `{ success: true, user: {...}, token: '...' }`
- [ ] Error: nothing stored in localStorage
- [ ] Error: returns `{ success: false, message: '...' }`

---

### **Test 3: Logout Function**

**What you're testing:**
- ✅ Calls correct endpoint: `/api/v1/auth/logout`
- ✅ Clears localStorage
- ✅ Works even if backend fails

```javascript
// First login to have data to clear
await Auth.login('testuser1', 'password123');
console.log('Before logout - Token exists:', !!localStorage.getItem('access_token'));

// Test logout
const logoutResult = await Auth.logout();
console.log('Logout result:', logoutResult);

// Verify YOUR frontend code cleared data:
console.log('✓ Token cleared?', !localStorage.getItem('access_token'));
console.log('✓ Token type cleared?', !localStorage.getItem('token_type'));
console.log('✓ User cleared?', !localStorage.getItem('user'));

// Expected frontend behavior:
// - Console shows: 🔵 [LOGOUT] Starting logout request...
// - Console shows: ✅ [LOGOUT] Backend logout successful
// - Console shows: 🗑️ [LOGOUT] localStorage cleared
// - logoutResult.success === true
// - All localStorage items removed
```

**Frontend checklist:**
- [ ] Correct API endpoint called (`/api/v1/auth/logout`)
- [ ] localStorage cleared regardless of backend response
- [ ] Returns `{ success: true }`
- [ ] Console logs show cleanup happened

---

### **Test 4: Helper Functions**

**What you're testing:**
- ✅ getCurrentUser() retrieves correct data
- ✅ getToken() retrieves correct data
- ✅ isAuthenticated() returns correct boolean

```javascript
// Test when logged out
Auth.clearAllAuthData();
console.log('getCurrentUser():', Auth.getCurrentUser()); // null
console.log('getToken():', Auth.getToken()); // null
console.log('isAuthenticated():', Auth.isAuthenticated()); // false

// Test when logged in
await Auth.login('testuser1', 'password123');
console.log('getCurrentUser():', Auth.getCurrentUser()); // { id, username, email }
console.log('getToken():', Auth.getToken()?.substring(0, 20) + '...'); // token preview
console.log('isAuthenticated():', Auth.isAuthenticated()); // true

// Test getAuthStatus
const status = Auth.getAuthStatus();
console.log('Full auth status:', status);
```

**Frontend checklist:**
- [ ] Helper functions read from localStorage correctly
- [ ] getCurrentUser() parses JSON correctly
- [ ] isAuthenticated() checks token existence
- [ ] getAuthStatus() returns complete status object

---

### **Test 5: Verify axiosConfig Interceptor**

**What you're testing:**
- ✅ Token automatically added to requests
- ✅ 401 errors clear localStorage

```javascript
// Login first
await Auth.login('testuser1', 'password123');

// Open Network tab in DevTools, then make a request
await axios.get('/api/v1/some-endpoint');

// Check in Network tab → Headers → Request Headers
// Should see: Authorization: bearer <your-token>

console.log('✓ Check Network tab for Authorization header');

// Test 401 handling (simulate expired token)
localStorage.setItem('access_token', 'invalid_token');
try {
  await axios.get('/api/v1/protected-endpoint');
} catch (error) {
  console.log('401 caught, localStorage cleared?', !localStorage.getItem('access_token'));
}
```

**Frontend checklist:**
- [ ] axios interceptor adds Authorization header automatically
- [ ] 401 response clears localStorage
- [ ] 401 response redirects to /login (if route exists)

---

**Prerequisites:**
1. Uncomment auth routes in `index.js`
2. Start React app: `yarn start` or `npm start`
3. App opens at `http://localhost:3000`

**Test Flow:**
1. Navigate to `http://localhost:3000/signup`
2. Fill in username, email, password
3. Click "Sign Up" → Should see success message → Auto-redirect to login
4. Login with credentials → Should redirect to homepage
5. Open DevTools → Application tab → Local Storage → Check `access_token` exists
6. Open Network tab → Make any API call → Check request has `Authorization` header
7. Click logout (need to add button) → localStorage cleared → Redirect to login

---

### Verification Checklist

**After successful login:**
- [ ] Console shows: 🔵 [LOGIN] Starting login request...
- [ ] Console shows: ✅ [LOGIN] Success
- [ ] Console shows: 💾 [LOGIN] Token stored in localStorage
- [ ] `localStorage.getItem('access_token')` returns a token
- [ ] `localStorage.getItem('user')` returns user JSON string
- [ ] Network tab shows `Authorization: bearer <token>` in request headers

**After failed login:**
- [ ] Console shows: ❌ [LOGIN] Failed
- [ ] Error message displayed
- [ ] No token in localStorage

**After logout:**
- [ ] Console shows: ✅ [LOGOUT] Backend logout successful
- [ ] Console shows: 🗑️ [LOGOUT] localStorage cleared
- [ ] `localStorage.getItem('access_token')` returns `null`
- [ ] Network tab shows NO Authorization header in future requests

**After 401 error:**
- [ ] localStorage automatically cleared
- [ ] Browser redirected to /login (if route exists)

---

## Summary

**Two files do all the heavy lifting:**

1. **`service/Auth.jsx`**
   - Talks to backend API
   - Stores JWT token in localStorage
   - Provides login/logout functions

2. **`utils/axiosConfig.js`**
   - Intercepts ALL axios requests
   - Automatically adds Authorization header
   - Handles expired tokens (401 errors)

**Developer experience:**
- Write: `axios.get('/api/endpoint')`  
- Get: Authenticated request automatically ✨
- No manual token management needed!

**Test from browser console to verify everything works before building the full UI!**
