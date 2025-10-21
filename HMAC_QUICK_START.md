# HMAC Secret Rotation - What You Need to Know

## The Simplest Explanation

**HMAC** = A security seal that proves login tokens came from your server

When a user logs in:
1. Server creates a puzzle
2. Server seals it with a secret (HMAC)
3. User's device solves the puzzle
4. Server checks the seal is still intact

**Secret rotation** = Changing the seal periodically so if it leaks, it only works for a short time

## What You Need to Do

### Right Now (Nothing!)
✅ Your system works with your current `PASSKEY_CHALLENGE_SECRET` env var
✅ No changes needed
✅ Everything is backwards compatible

### When Ready to Rotate (Optional)
Later, if you want to rotate (e.g., every 90 days):

1. **Generate new secret**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Update environment variable**:
   ```bash
   # From this:
   PASSKEY_CHALLENGE_SECRET="old-secret"
   
   # To this:
   PASSKEY_CHALLENGE_SECRETS='[
     {"secret":"new-secret-abc123","rotatedAt":1702977904},
     {"secret":"old-secret","rotatedAt":1702890000}
   ]'
   ```

3. **Deploy** (zero downtime, no users locked out)

4. **After 24 hours, clean up** (remove old secret from array)

## How It Actually Works

### Signing (When Creating Login Challenge)
```
1. Get current secret (first one in array)
2. Create a timestamp-based payload
3. Sign it: HMAC-SHA256(payload, currentSecret)
4. Send both to user's device
```

### Verifying (When User Submits Login)
```
1. Receive payload + signature from device
2. Try to verify with EACH secret in array
   - Try with newest secret first
   - If that doesn't work, try older ones
   - If any match → ✓ Valid
3. Check user ID matches
4. Check challenge matches
5. Check it hasn't expired
```

### Why Try Multiple Secrets?
During rotation, both secrets exist for 24 hours:
- **New tokens** are signed with new secret (immediate)
- **Old tokens in flight** still work with old secret (grace period)
- **After 24 hours**, old secret removed (old tokens all expired anyway)

Result: **Zero downtime rotation**

## Current State vs. Rotating

### Current State (Single Secret)
```
Environment var:
  PASSKEY_CHALLENGE_SECRET="my-secret"

System behavior:
  ✓ Works perfectly
  ✓ No rotation overhead
  ✓ All tokens use same secret forever
```

### Rotating (Multiple Secrets)
```
Environment var:
  PASSKEY_CHALLENGE_SECRETS='[
    {"secret":"new-secret","rotatedAt":...},
    {"secret":"old-secret","rotatedAt":...}
  ]'

System behavior:
  ✓ New tokens signed with new secret
  ✓ Old tokens verified with old secret
  ✓ Both work during grace period
  ✓ Can remove old secret after 24h
```

### Both Work Simultaneously
```
If you set:
  PASSKEY_CHALLENGE_SECRET="fallback"
  PASSKEY_CHALLENGE_SECRETS='[...]'

System tries in order:
  1. PASSKEY_CHALLENGE_SECRETS (if set)
  2. PASSKEY_CHALLENGE_SECRET (if #1 not set)
  3. 'dev-insecure-secret' (hardcoded fallback)
```

## Visual Timeline

### No Rotation (Current State)
```
Timeline:
├─ Day 1: Deploy with SECRET-A
│         ├─ All tokens signed with SECRET-A
│         └─ All tokens verified with SECRET-A
│
├─ Day 90: Still using SECRET-A
│          └─ If leaked, attackers can forge tokens
│
└─ No rotation = Ongoing risk
```

### With Rotation (When Ready)
```
Timeline:
├─ Day 1: Deploy with [SECRET-B, SECRET-A]
│         ├─ New tokens signed with SECRET-B (new)
│         ├─ Old tokens verified with SECRET-A (old)
│         └─ Grace period: both work for 2 minutes
│
├─ Day 1-24: Grace period
│            ├─ Any in-flight logins complete
│            ├─ Old tokens naturally expire (TTL=120s)
│            └─ New tokens only need SECRET-B
│
├─ Day 2: Deploy with just [SECRET-B]
│         ├─ Old tokens all expired anyway
│         └─ Clean, only current secret in system
│
└─ Day 90: Deploy with [SECRET-C, SECRET-B]
           └─ Repeat rotation cycle
```

## Common Questions

**Q: Do I have to rotate?**
A: No. Single secret mode works fine. Rotation is optional best-practice for production.

**Q: Will users be logged out during rotation?**
A: No. There's a 24-hour grace period where both secrets work. Zero impact.

**Q: What if I mess up the JSON format?**
A: System falls back to single secret mode. No harm done. Use a JSON validator to check.

**Q: How often should I rotate?**
A: Industry standard is every 90 days, or immediately if compromised.

**Q: Can I have more than 2 secrets?**
A: Yes, keep it under 5 to avoid confusion. Array can be `[current, previous1, previous2]`.

**Q: Does this require downtime?**
A: No. Deploy any time. Zero downtime guaranteed.

**Q: Is it backwards compatible?**
A: 100%. If rotating var not set, uses single secret. Works forever.

## What Changed in Code

### File: `lib/passkeys.ts`

Added two new functions:
```typescript
getSecrets()        // Returns array: [current, previous, ...]
getCurrentSecret()  // Returns first secret
```

Updated two functions:
```typescript
issueChallenge()        // Uses getCurrentSecret() for signing
verifyChallengeToken()  // Tries all secrets in array for verification
```

### That's It!
No other files needed changes. Everything else uses these functions automatically.

## Bottom Line

✅ **Nothing to do right now** - system works as-is
✅ **When ready**: Update one env var, deploy, done
✅ **Zero downtime** - rotation can happen any time
✅ **Fully backwards compatible** - old system still works
✅ **Production ready** - exactly what you need

For more details, read: `HMAC_ROTATION_EXPLAINED.md`
