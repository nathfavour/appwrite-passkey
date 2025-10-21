# HMAC Secret Rotation - Simple Explanation

## TL;DR (If you're in a hurry)

**You don't need to do anything right now.** The system works with your existing `PASSKEY_CHALLENGE_SECRET` env var.

When you're ready to rotate secrets (optional, every 90 days or when needed):
1. Generate a new secret
2. Update one environment variable
3. Deploy (zero downtime)

---

## How It Works (Simple Version)

### The Problem It Solves

Imagine you have a secret password: `"my-secret-key-12345"`

If someone steals this secret, they can forge fake login tokens forever.

The HMAC rotation lets you:
1. Change the secret periodically
2. Accept old secrets temporarily (so existing logins still work)
3. Gradually phase out old secrets

### The Process

```
Challenge is a cryptographic "puzzle" that proves the user owns the device

Step 1: User wants to sign in
  → Server creates a challenge (random puzzle)
  → Server signs it with SECRET using HMAC
  → Sends signed challenge to user's device

Step 2: User solves the puzzle on their device
  → Device proves it solved the puzzle

Step 3: Server verifies the solution
  → Checks if user really solved it
  → Server already knows what the correct answer is
  → Server verifies user's solution matches
```

**The HMAC is like a tamper-proof seal on the puzzle.**

---

## What Changed (Technical)

### Before
```typescript
// Old way: Fixed single secret in code
const secret = process.env.PASSKEY_CHALLENGE_SECRET || 'dev-insecure-secret';

// Signing (used this ONE secret)
const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');

// Verifying (had to use that ONE secret)
if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
  // Valid!
}
```

### After
```typescript
// New way: Get current secret from environment
function getSecrets(): Array<{ secret: string; rotatedAt: number }> {
  // Try rotating secrets array first
  const rotatingSecretsJson = process.env.PASSKEY_CHALLENGE_SECRETS;
  if (rotatingSecretsJson) {
    return JSON.parse(rotatingSecretsJson);
  }
  // Fall back to single secret (backwards compatible!)
  return [{ secret: process.env.PASSKEY_CHALLENGE_SECRET || 'dev-insecure-secret' }];
}

// Signing (uses FIRST secret in array - the current one)
const currentSecret = getSecrets()[0].secret;
const sig = crypto.createHmac('sha256', currentSecret).update(payload).digest('base64url');

// Verifying (tries ALL secrets in array - current + previous)
const secrets = getSecrets();
for (const secretObj of secrets) {
  const expectedSig = crypto.createHmac('sha256', secretObj.secret).update(payload).digest('base64url');
  if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    validSig = true;
    break;
  }
}
```

---

## What You Need To Know (Right Now)

### Option 1: Do Nothing (Easiest)
- ✅ Keep your existing `PASSKEY_CHALLENGE_SECRET` env var
- ✅ Everything works as before
- ✅ System automatically handles it
- ⏸️ You can rotate later when you want

### Option 2: Prepare for Rotation (Recommended for Production)
- Decide on a rotation schedule (e.g., every 90 days)
- When it's time to rotate: see "How to Rotate" section below

---

## How to Rotate (When You're Ready)

### Step 1: Generate New Secret
```bash
# Generate a new random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output: abc123def456... (copy this)
```

### Step 2: Update Environment Variable

**Current env var:**
```bash
PASSKEY_CHALLENGE_SECRET="old-secret-12345"
```

**Change it to:**
```bash
PASSKEY_CHALLENGE_SECRETS='[
  {
    "secret": "new-secret-789abc",
    "rotatedAt": 1702977904
  },
  {
    "secret": "old-secret-12345",
    "rotatedAt": 1702890000
  }
]'
```

**Important notes:**
- Array format: `[{...}, {...}]` (it's JSON!)
- NEW secret goes FIRST (index 0)
- OLD secret goes SECOND
- `rotatedAt` is just a timestamp (any number works)
- Keep old secret for 24+ hours

### Step 3: Deploy
```bash
git add .
git commit -m "chore: rotate HMAC secret"
git push
# Deploy normally - NO DOWNTIME
```

### Step 4: Wait & Clean Up
After 24+ hours:
- All old tokens have expired (TTL is 120 seconds)
- All in-flight logins completed
- Safe to remove old secret

**Remove old secret:**
```bash
PASSKEY_CHALLENGE_SECRETS='[
  {
    "secret": "new-secret-789abc",
    "rotatedAt": 1702977904
  }
]'
```

Deploy again - done!

---

## Why This Matters (Security)

### Without Rotation
```
Day 1: Secret leaked by accident
Day 2-365: Attacker can forge tokens for AN ENTIRE YEAR
```

### With Rotation
```
Day 1: Secret leaked by accident
Day 2: You notice and rotate
Day 3: Old secret removed from system
Day 4: Attacker's forged tokens no longer work
```

**Difference: 362 days of protection!**

---

## Grace Period Explanation

When you rotate, there's a **grace period** where both secrets work:

```
Timeline:
├─ 12:00 PM: Deploy with new secret + old secret
│            ✓ New tokens signed with NEW secret
│            ✓ Old tokens still verified with OLD secret
│
├─ 12:00 PM - 12:02 PM: Grace period (2 minutes)
│            ✓ Any in-flight logins still work
│
└─ 12:02 PM onwards:
             ✓ All old tokens expired (TTL = 120 seconds)
             ✓ Can safely remove old secret
```

Why 2 minutes? Because challenges expire after 120 seconds (2 minutes).

---

## Common Questions

**Q: Do I have to rotate secrets?**
A: No, it's optional. The old system works fine. But it's good security practice to rotate every 90 days in production.

**Q: What if I forgot to remove the old secret after 24 hours?**
A: It doesn't hurt - it just takes up a bit of space in env var. But remove it when you remember.

**Q: Can I rotate more than 2 secrets at once?**
A: Yes! Array can be 2, 3, or more secrets. But keep it under 5 to avoid confusion.

**Q: What if I put the secret in the wrong order?**
A: 
- If you put NEW first (correct): ✅ Works, new tokens use new secret
- If you put OLD first (wrong): ❌ New tokens use old secret, not ideal but still works

**Q: How do I know when to rotate?**
A: Good times to rotate:
- Every 90 days (routine rotation)
- Immediately if you suspect a leak
- When a developer leaves the team
- During security hardening

**Q: Is there any downtime during rotation?**
A: No! Rotation is zero-downtime because:
- New tokens use new secret
- Old tokens accepted with old secret
- Both work during grace period
- No user is locked out

---

## Environment Variable Formats

### Current (Works Without Doing Anything)
```bash
PASSKEY_CHALLENGE_SECRET="my-secret-key"
```

### For Rotation (Optional)
```bash
PASSKEY_CHALLENGE_SECRETS='[{"secret":"new","rotatedAt":123},{"secret":"old","rotatedAt":456}]'
```

Note: The second format is pure JSON in a string. If you have trouble:
- Make sure it's valid JSON (use a JSON validator)
- Make sure it's in quotes (single quotes recommended for bash)
- Make sure all quotes inside are double quotes

### Both at Same Time (Also Works)
```bash
PASSKEY_CHALLENGE_SECRET="fallback-secret"
PASSKEY_CHALLENGE_SECRETS='[{"secret":"new","rotatedAt":123}]'
```

Priority: 
1. Try `PASSKEY_CHALLENGE_SECRETS` first
2. If that doesn't exist, use `PASSKEY_CHALLENGE_SECRET`
3. If that doesn't exist, use hardcoded fallback (dev only)

---

## What's Actually Happening (Deep Dive)

### When User Tries to Sign In

```typescript
// 1. Browser asks for login options
GET /api/webauthn/auth/options?email=alice@example.com

// 2. Server creates a challenge
challenge = "random-puzzle-12345"
payload = {
  u: "alice@example.com",     // user (u for short)
  c: challenge,                // challenge (c for short)
  e: 1702977904               // expiry time (e for short)
}

// 3. Server signs the payload with HMAC
sig = HMAC-SHA256(secret, JSON.stringify(payload))

// 4. Server sends both to browser
response = {
  challenge: "random-puzzle-12345",
  challengeToken: base64(payload) + "." + base64(sig)
}

// 5. Browser's device solves the puzzle (biometric, PIN, etc.)

// 6. Browser sends solution back with token
POST /api/webauthn/auth/verify
{
  userId: "alice@example.com",
  assertion: {solved_puzzle_data},
  challenge: "random-puzzle-12345",
  challengeToken: base64(payload) + "." + base64(sig)
}

// 7. Server verifies the token
tokens = getSecrets()  // Get all secrets [new, old, ...]
for each secret in tokens:
  expectedSig = HMAC-SHA256(secret, JSON.stringify(payload))
  if (expectedSig == receivedSig):
    ✓ Valid! User is authenticated

// 8. Server checks timestamp
if (now > expiry_time):
  ❌ Reject - challenge expired

// 9. Server checks user binding
if (payload.u != userId):
  ❌ Reject - wrong user

// 10. Server checks challenge matches
if (payload.c != challenge):
  ❌ Reject - challenge mismatch
```

---

## Implementation Details (For Developers)

### File: `lib/passkeys.ts`

```typescript
// These are the new functions added:

getSecrets()          // Returns array of secrets from env
getCurrentSecret()    // Returns the first (current) secret

// These were updated:

issueChallenge()      // Now uses getCurrentSecret()
verifyChallengeToken() // Now tries all secrets
```

### No Changes Needed In
- `/api/webauthn/register/options`
- `/api/webauthn/register/verify`
- `/api/webauthn/auth/options`
- `/api/webauthn/auth/verify`

Everything works automatically!

---

## Summary

| Aspect | Status | What You Do |
|--------|--------|-----------|
| **Current State** | ✅ Works | Nothing - use existing PASSKEY_CHALLENGE_SECRET |
| **For Production** | ✅ Ready | (Optional) Set up rotation schedule |
| **When Rotating** | ✅ Easy | Update one env var + deploy |
| **Downtime** | ✅ Zero | Deploy during any time, no user impact |
| **Breaking Changes** | ✅ None | Fully backwards compatible |

---

**Bottom line**: You don't need to do anything. The system works with your current setup. When you're ready to rotate (optional), just update one environment variable and deploy.
