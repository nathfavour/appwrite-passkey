# Passkey Connection Flow - Linking to Existing Session

## Problem Solved

When a user is already authenticated (e.g., via Google OAuth) and wants to add a passkey:

1. **Session Already Exists**: Can't create another session (Appwrite error: "session prohibited when session already active")
2. **Identity Verification**: How do we know it's the same user trying to add the passkey?
3. **UX Issue**: Standard registration flow tries to create a session, which fails

## Solution: Connection Flow

A dedicated endpoint for **connecting** a passkey to an existing authenticated session.

### Key Differences from Registration

| Aspect | Registration | Connection |
|--------|--------------|-----------|
| **Requires Session** | ❌ No | ✅ YES (must be logged in) |
| **Identity Check** | ❌ No (new user) | ✅ YES (verify session matches) |
| **Creates Session** | ✅ Yes | ❌ NO (user already has one) |
| **Rate Limited** | ✅ Yes | ✅ YES (same rules) |
| **Passkey Logic** | ✅ Standard | ✅ SAME (uses same storage) |
| **End Result** | Session token | No token (stay authenticated) |

---

## How It Works

### Step 1: User Already Authenticated
```
User logs in with Google OAuth
↓
Appwrite creates session
↓
User authenticated via Authorization header
```

### Step 2: Request Connection Options
```
Client:
  POST /api/webauthn/connect/options
  {
    "email": "user@example.com"
  }
  Headers: Authorization: Bearer {sessionToken}

Server:
  1. Check Authorization header present ✓
  2. Verify user exists ✓
  3. Generate registration options (same as registration)
  4. Create challenge token ✓
  5. Return options (NO session created)
```

### Step 3: User Solves Challenge
```
User's device (biometric, PIN, etc.):
  1. Receives challenge
  2. Solves it (proves device ownership)
  3. Returns solution + challenge token
```

### Step 4: Verify and Store
```
Client:
  POST /api/webauthn/connect/verify
  {
    "email": "user@example.com",
    "assertion": {...},
    "challenge": "...",
    "challengeToken": "..."
  }
  Headers: Authorization: Bearer {sessionToken}

Server:
  1. Check Authorization header ✓
  2. Verify user exists ✓
  3. Check rate limit ✓
  4. Verify challenge ✓
  5. Verify WebAuthn registration ✓
  6. Store passkey (same logic as registration) ✓
  7. Return success (NO new session) ✓
```

### Step 5: User Now Has Passkey
```
User can now:
  • Sign out of Google session
  • Sign in with the newly connected passkey
  • Or keep both auth methods
```

---

## Endpoints

### 1. GET Registration Options (Connection)

**Endpoint**: `POST /api/webauthn/connect/options`

**Requires**: Active session (Authorization header with bearer token)

**Request**:
```json
{
  "email": "user@example.com"
}
```

**Response** (200 OK):
```json
{
  "challenge": "base64url_challenge",
  "rp": {
    "name": "Appwrite Passkey",
    "id": "example.com"
  },
  "user": {
    "id": "base64url_user_id",
    "name": "user@example.com",
    "displayName": "user@example.com"
  },
  "pubKeyCredParams": [...],
  "timeout": 60000,
  "attestation": "none",
  "authenticatorSelection": {...},
  "challengeToken": "base64url.signature"
}
```

**Errors**:
- `401` - No active session
- `404` - User not found
- `400` - Invalid request

---

### 2. Verify Registration & Store Passkey

**Endpoint**: `POST /api/webauthn/connect/verify`

**Requires**: Active session (Authorization header with bearer token)

**Request**:
```json
{
  "email": "user@example.com",
  "assertion": {
    "id": "...",
    "rawId": "...",
    "type": "public-key",
    "response": {
      "clientDataJSON": "...",
      "attestationObject": "..."
    }
  },
  "challenge": "base64url_challenge",
  "challengeToken": "base64url.signature"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Passkey connected successfully. You can now sign in with it."
}
```

**Errors**:
- `401` - No active session
- `404` - User not found
- `400` - Invalid challenge, malformed attestation, verification failed
- `429` - Rate limited
- `500` - Internal error

---

## Security Guarantees

✅ **Session Required**: Can't connect without being authenticated
✅ **Identity Verification**: Must provide matching email
✅ **Rate Limited**: Same rate limiting as auth flow
✅ **Challenge Binding**: User bound to challenge (can't be reused)
✅ **No Session Injection**: Passkey stored without creating new session
✅ **No Account Hijacking**: Can only connect to own account
✅ **Attempt Tracking**: All attempts tracked in user prefs (same as auth)

---

## Implementation Details

### File Locations
```
app/api/webauthn/connect/
  ├── options/route.ts      (Generate registration options)
  └── verify/route.ts       (Verify & store passkey)
```

### Code Reuse
- Uses `issueChallenge()` (same as registration)
- Uses `verifyChallengeToken()` (same as registration)
- Uses `registerPasskey()` (same as registration)
- Uses `checkAuthRateLimit()` (same as auth)
- Uses `recordAuthAttempt()` (same as auth)

### Same Security as Registration
The passkey registration logic is identical to the standard registration flow:
- Same WebAuthn verification
- Same cryptographic checks
- Same credential storage
- Same counter tracking
- Same error handling

Only difference: No session creation at the end (user already authenticated)

---

## Client-Side Usage Example

```typescript
// 1. User is authenticated with Google
// They navigate to "Add Passkey" page

// 2. Request connection options
const optionsResponse = await fetch('/api/webauthn/connect/options', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${googleSessionToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com'
  })
});

const options = await optionsResponse.json();
const challengeToken = options.challengeToken;

// 3. User's device handles WebAuthn
const attestation = await navigator.credentials.create({
  publicKey: options
});

// 4. Send solution back for verification
const verifyResponse = await fetch('/api/webauthn/connect/verify', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${googleSessionToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    assertion: attestation,
    challenge: options.challenge,
    challengeToken: challengeToken
  })
});

const result = await verifyResponse.json();

if (result.success) {
  // Passkey connected!
  // User can now sign out and sign in with passkey
  showSuccessMessage('Passkey added successfully');
} else {
  showErrorMessage(result.error);
}
```

---

## User Flow Diagram

```
User (Google authenticated)
    ↓
    ├─ Visits "Link Passkey" page
    ↓
Client:
    └─ POST /api/webauthn/connect/options
        ↓
Server:
    ├─ Verify session active ✓
    ├─ Check user exists ✓
    ├─ Generate challenge ✓
    ↓
Client:
    ├─ Display "Touch your device"
    ├─ User confirms (biometric/PIN)
    ↓
Client:
    └─ POST /api/webauthn/connect/verify
        ↓
Server:
    ├─ Verify session ✓
    ├─ Verify challenge ✓
    ├─ Verify WebAuthn ✓
    ├─ Store passkey ✓
    ├─ NO session created
    ↓
Client:
    ├─ "Passkey connected!"
    ├─ User stays authenticated as Google
    ├─ (Can now use passkey next time)
    ↓
Later:
    ├─ User signs out
    ├─ User can sign in with passkey
    └─ Or sign in with Google again
```

---

## Why No Session Creation?

In a standard auth flow:
```
Register → Verify → Create Session → Return token
```

In connection flow:
```
Authenticated user → Connect passkey → Store → NO session (already have one)
```

Why?
- **Appwrite rule**: Can't create session when one already exists
- **UX**: User stays in their authenticated session
- **Security**: Using existing session as proof of identity
- **Logic**: No need for new session, just linking an auth method

---

## Comparison: Registration vs. Connection

### Registration Flow
```typescript
POST /api/webauthn/register/options
  → No session required
  → Create new user if needed
  → Return options + challenge

POST /api/webauthn/register/verify
  → Verify WebAuthn
  → Create new user if needed
  → Store passkey
  → CREATE SESSION ← Different!
  → Return session token
```

### Connection Flow
```typescript
POST /api/webauthn/connect/options
  → Session required ← Different!
  → Verify user exists
  → Return options + challenge

POST /api/webauthn/connect/verify
  → Verify session ← Different!
  → Verify WebAuthn
  → User already exists
  → Store passkey
  → NO SESSION ← Different!
  → Return success
```

---

## Error Handling

### 401 Unauthorized (No Session)
```json
{
  "error": "No active session. Please sign in first."
}
```
**Action**: Redirect to login

### 404 Not Found (User Doesn't Exist)
```json
{
  "error": "User not found"
}
```
**Action**: This shouldn't happen if session is valid

### 429 Too Many Requests (Rate Limited)
```json
{
  "error": "Rate limited",
  "status": "limited"
}
```
**Action**: Show countdown timer, suggest email verification

### 400 Bad Request (Verification Failed)
```json
{
  "error": "Registration verification failed"
}
```
**Action**: Show "Try again" button

---

## Testing

### Manual Test
```bash
# 1. Get session token (via Google or other auth)
SESSION_TOKEN="..."

# 2. Request options
curl -X POST http://localhost:3000/api/webauthn/connect/options \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'

# 3. Use returned challenge with WebAuthn API
# 4. Verify with returned token

curl -X POST http://localhost:3000/api/webauthn/connect/verify \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

---

## Summary

| Aspect | Details |
|--------|---------|
| **Purpose** | Link passkey to existing authenticated session |
| **Requires** | Active session (Authorization header) |
| **Creates Session** | No (user already has one) |
| **Rate Limited** | Yes (same as auth) |
| **Security** | Same as registration (all checks applied) |
| **End Result** | Passkey stored, user stays authenticated |
| **UX** | Seamless - no forced logout/login |
| **Use Case** | "Add Passkey" for authenticated users |

---

## Files Changed

**New Files**:
- `app/api/webauthn/connect/options/route.ts`
- `app/api/webauthn/connect/verify/route.ts`

**Updated Files**:
- `lib/passkey-server.ts` - Made `parseCredsMap` public

---

**Status**: ✅ Ready for implementation
