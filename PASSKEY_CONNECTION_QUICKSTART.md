# Passkey Connection - Quick Reference

## What's New

New endpoints for connecting a passkey to an existing authenticated session.

## Endpoints

### Connect Options
```
POST /api/webauthn/connect/options
Authorization: Bearer {sessionToken}
Content-Type: application/json

{
  "email": "user@example.com"
}

Response:
{
  "challenge": "...",
  "challengeToken": "...",
  // ... WebAuthn options
}
```

### Connect Verify
```
POST /api/webauthn/connect/verify
Authorization: Bearer {sessionToken}
Content-Type: application/json

{
  "email": "user@example.com",
  "assertion": {...},
  "challenge": "...",
  "challengeToken": "..."
}

Response:
{
  "success": true,
  "message": "Passkey connected successfully. You can now sign in with it."
}
```

## Differences from Registration

| Aspect | Registration | Connection |
|--------|--------------|-----------|
| **URL** | `/register/` | `/connect/` |
| **Auth Required** | No | YES ← |
| **Session Created** | Yes | NO ← |
| **When to Use** | New account | Add to existing ← |

## Why Separate Endpoint?

**Registration flow tries to create session** → Fails if user already authenticated

**Connection flow skips session** → Works while authenticated

## Key Features

✅ **Identity Verified**: Session proves who user is
✅ **No Forced Logout**: User stays logged in
✅ **Same Security**: Uses all same checks as registration
✅ **Rate Limited**: Same limits as auth
✅ **No Hijacking**: Can only connect to own account (via session)

## Client Code

```typescript
// Requires user to already be authenticated
const sessionToken = getSessionToken();
const email = getCurrentUserEmail();

// 1. Get options
const options = await fetch('/api/webauthn/connect/options', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${sessionToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ email })
}).then(r => r.json());

// 2. Create credential
const attestation = await navigator.credentials.create({
  publicKey: options
});

// 3. Verify
const result = await fetch('/api/webauthn/connect/verify', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${sessionToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email,
    assertion: attestation,
    challenge: options.challenge,
    challengeToken: options.challengeToken
  })
}).then(r => r.json());

// Result: { success: true, message: "..." }
```

## Errors

| Status | Meaning |
|--------|---------|
| 401 | No session (not authenticated) |
| 404 | User not found |
| 400 | Invalid request or verification failed |
| 429 | Rate limited |
| 500 | Server error |

## Security Checklist

- ✅ Session required before allowing connection
- ✅ User verified via session
- ✅ Challenge time-bound (120 seconds)
- ✅ Challenge user-bound (can't steal)
- ✅ WebAuthn verified (cryptographically)
- ✅ Rate limited (same as auth)
- ✅ No privilege escalation (same user)
- ✅ No account hijacking (session controls access)

## Use Cases

### "Add Passkey" Feature
User signs in with Google → Sees "Add Passkey" button → Connects passkey → Can now use passkey to sign in next time

### Account Linking
User wants multiple auth methods:
- Sign in with Google
- OR sign in with passkey
- OR sign in with email/password

### No-Password Future
- Remove dependency on passwords
- Add passkey as alternative
- Keep existing auth methods

## Files

**Endpoints**:
- `app/api/webauthn/connect/options/route.ts`
- `app/api/webauthn/connect/verify/route.ts`

**Documentation**:
- `PASSKEY_CONNECTION_FLOW.md` (comprehensive)
- `PASSKEY_CONNECTION_STATUS.md` (implementation notes)
- This file (quick reference)

## Comparison

### Registration
```
Unauthenticated user
  ↓
POST /api/webauthn/register/options
  ↓
User solves challenge
  ↓
POST /api/webauthn/register/verify
  ↓
Session created, token returned
  ↓
User now authenticated
```

### Connection
```
Authenticated user (Google)
  ↓
POST /api/webauthn/connect/options
  ↓
User solves challenge
  ↓
POST /api/webauthn/connect/verify
  ↓
Passkey stored, NO session created
  ↓
User stays authenticated with existing session
```

## Authentication Flow Example

```
User visits app
  ↓
Not authenticated? → Go to login
Authenticated? → Show app + "Link Passkey" button
  ↓
User clicks "Link Passkey"
  ↓
Frontend:
  POST /api/webauthn/connect/options (with session token)
  ↓
Server:
  Check session exists ✓
  Check user exists ✓
  Generate challenge ✓
  Return options
  ↓
Frontend:
  navigator.credentials.create()
  ↓
User touches device (biometric/PIN)
  ↓
Frontend:
  POST /api/webauthn/connect/verify
  ↓
Server:
  Check session ✓
  Check WebAuthn ✓
  Store passkey ✓
  Return success
  ↓
Frontend:
  Show "Passkey connected!"
  ↓
Later, user can:
  Sign out → Sign in with passkey
  OR keep both Google + passkey
```

## Rate Limiting

Same as auth flow:
- 10 attempts per 60 seconds (default)
- Per-user isolation
- Progressive warnings
- Temporary lockout after violations

See: `IMPLEMENTATION_STATUS.md` for details

## No New Dependencies

- ✅ Uses existing @simplewebauthn
- ✅ Uses existing crypto module
- ✅ Uses existing rate limiting
- ✅ Uses existing Appwrite integration

## Status

✅ Implemented
✅ Documented
✅ Tested (compiles)
✅ Backwards compatible
✅ Ready for use

---

**Read PASSKEY_CONNECTION_FLOW.md for full documentation.**
