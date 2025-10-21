# Security Analysis: Self-Hosted Passkey vs Third-Party Services

## Overall Security Score: **6-7 / 10**
*Third-party services (Passwordless.dev, Auth0, Yubico): 8.5/10*

---

## STRONG AREAS (Equivalent to Third-Party)

### ✅ Core WebAuthn Cryptography (9/10)
- Uses industry-standard `@simplewebauthn/server` library
- Same verification as commercial services
- Proper signature validation & counter replay detection

### ✅ Challenge-Response Security (8/10)
- Stateless HMAC-signed tokens with time binding
- User-bound challenges prevent cross-user attacks
- Timing-safe comparison using `crypto.timingSafeEqual()`

### ✅ Credential Isolation (7/10)
- Each passkey stored per-user in Appwrite
- One leaked credential doesn't expose others

### ✅ Basic Rate Limiting (6/10)
- Per-IP rate limiting on registration/auth
- Prevents basic brute force

---

## CRITICAL WEAKNESSES

### 🔴 CRITICAL: Secret Key Management (4/10)

**Location**: `lib/passkeys.ts` line 18
```typescript
const secret = process.env.PASSKEY_CHALLENGE_SECRET || 'dev-insecure-secret';
```

**Vulnerabilities**:
- If `PASSKEY_CHALLENGE_SECRET` leaks → attacker can forge ANY valid challenge token
- Default fallback is `'dev-insecure-secret'` (publicly known)
- Stored in plain environment variables
- No rotation mechanism
- No key versioning

**Attack Path**:
1. Attacker obtains `PASSKEY_CHALLENGE_SECRET` from logs/env dump
2. Attacker generates valid `challengeToken` for `victim@example.com`
3. Attacker creates fake attestation object
4. System accepts it (HMAC validates correctly)
5. **Full account takeover**

**Third-Party Advantage**: Services rotate secrets internally, never exposed to users

**Fix**: Implement automated key rotation every 90 days
**Impact**: +1.0 points

---

### 🔴 HIGH: Distributed Rate Limiting (4/10)

**Location**: `lib/rateLimit.ts`
```typescript
const buckets = new Map<string, Bucket>();  // Lost on server restart!
```

**Vulnerabilities**:
- Rate limiter resets on server restart
- Doesn't work across multiple instances
- Each instance has separate bucket
- Attacker distributes requests across instances

**Attack Path** (multi-instance deployment):
1. Production runs 5 instances of the app
2. Limit is 10 attempts per instance per window
3. Attacker sends 2 requests to each instance
4. Effective limit: 10 × 5 = 50 attempts total (should be 10)
5. Brute force becomes feasible

**Third-Party Advantage**: Distributed caches (Redis, Memcached) with persistence

**Fix**: Move to Redis/Memcached
**Impact**: +0.8 points

---

### 🔴 HIGH: Counter Replay Detection (5/10)

**Location**: `lib/passkey-server.ts` line 173
```typescript
counterObj[credentialId] = newCounter;  // Just overwrites, no backwards check
```

**Vulnerabilities**:
- If attacker clones device's passkey → both can sign in indefinitely
- No detection if counter goes backwards
- No alert mechanism
- Race conditions on concurrent logins

**Attack Path**:
1. Attacker somehow obtains user's passkey private key (device exported/stolen)
2. Attacker signs in → counter: 5 → 6
3. Legitimate user signs in → counter: 6 → 7
4. System has no idea one is cloned
5. Both continue to have access indefinitely

**Third-Party Advantage**: Monitors full auth history, detects anomalies

**Fix**: Reject sign-in if counter goes backwards, require account recovery
**Impact**: +0.6 points

---

### 🟠 HIGH: Server API Key Exposure (5/10)

**Location**: `lib/passkey-server.ts` line 9
```typescript
const serverApiKey = process.env.APPWRITE_API || process.env.APPWRITE_API_KEY || '';
```

**Vulnerabilities**:
- If server is compromised (RCE, log injection) → key is exposed
- Key has full Appwrite permissions (not scoped)
- Can modify ANY user account
- Can register passkeys for anyone

**Attack Path**:
1. Attacker finds RCE vulnerability elsewhere in app
2. Executes `process.env` to extract `APPWRITE_API`
3. Uses API key to modify all user accounts
4. Registers passkeys for any user
5. Can impersonate anyone

**Third-Party Advantage**: Issues scoped tokens with minimal permissions

**Fix**: Use Appwrite server-side functions with scoped API keys
**Impact**: +0.5 points

---

### 🟠 MEDIUM: No Attestation Validation (2/10)

**Location**: `app/api/webauthn/register/options/route.ts` line 49
```typescript
attestationType: 'none',
```

**Vulnerabilities**:
- Can't verify device is genuine
- Attacker could use JavaScript-based WebAuthn emulator
- No way to enforce hardware keys
- No rollback protection

**Attack Path**:
1. Attacker uses JavaScript-based WebAuthn emulator (e.g., fake WebAuthn)
2. Emulator creates attestation that looks valid
3. System accepts it (can't validate attestation format)
4. Attacker now has software-based "passkey" (easier to steal)

**Third-Party Advantage**: Offer attestation validation and metadata statements

**Fix**: Change `attestationType` from `'none'` to `'direct'` or `'indirect'`
**Impact**: +0.4 points

---

### 🟡 MEDIUM: Email Verification Not Required (2/10)

**Location**: `lib/passkey-server.ts` line 50 (prepareUser)

**Vulnerabilities**:
- Email squatting: Attacker registers `ceo@company.com` before real CEO
- Attacker adds passkey to spoofed account
- Real CEO later sees "Account already exists"
- Real CEO locked out unless password recovery exists

**Attack Path**:
1. Attacker registers passkey for `executive@company.com`
2. Real executive visits app
3. Real executive sees "Account already exists"
4. Must use account recovery (if available)
5. Attacker has squatted the account

**Note**: Your fix mitigates this by blocking re-registration on existing accounts!
But still vulnerable to initial squatting.

**Third-Party Advantage**: Enforce email verification before passkey activation

**Fix**: Send verification email, require click-through before passkey activation
**Impact**: +0.3 points

---

### 🟡 MEDIUM: No Device Anomaly Detection (1/10)

**Vulnerabilities**:
- Passkey used from different country instantly → no alert
- Multiple simultaneous sign-ins → not flagged
- Sign-in from VPN/Tor → not detected
- Compromised key used weeks later → no forensic trail

**Third-Party Advantage**: Implement geolocation checks, device reputation, anomaly scoring

**Fix**: Implement GeoIP checks, device fingerprinting
**Impact**: +0.4 points

---

### 🟡 MEDIUM: No Revocation/Session Management (3/10)

**Vulnerabilities**:
- If device is stolen → user can't revoke the passkey
- User must use account recovery
- Can't see "active sessions" using this passkey
- No "sign out all devices" option

**Attack Path**:
1. User's phone with Face ID passkey is stolen
2. User tries to sign in to app to revoke it
3. Can't → they're locked out (attacker has the passkey)
4. Must go through password recovery
5. Thief can keep trying indefinitely

**Third-Party Advantage**: Provide session management UI, remote revocation

**Fix**: Add revocation endpoint + user dashboard
**Impact**: +0.5 points

---

### 🟡 LOW: No Audit Logging (1/10)

**Vulnerabilities**:
- Can't audit who registered when
- Can't detect unusual patterns
- No incident response capability
- Compliance failures (SOC2, HIPAA)

**Third-Party Advantage**: Provide audit logs, compliance dashboards

**Fix**: Log all passkey events to Elasticsearch or CloudWatch
**Impact**: +0.5 points

---

## ATTACK VECTORS RANKED BY SEVERITY

| Attack | Likelihood | Impact | Effort to Fix |
|--------|-----------|--------|---------------|
| HMAC Secret Compromise | Medium | CRITICAL | Low |
| Rate Limit Bypass (Multi-Instance) | High | HIGH | Medium |
| Cloned Passkey Detection Failure | Low | MEDIUM | Low |
| Server Compromise via API Key | Medium | CRITICAL | High |
| Software Passkey Forgery | Medium | MEDIUM | Low |
| Email Squatting | Medium | MEDIUM | Medium |

---

## SCORECARD COMPARISON

| Category | Self-Hosted | Third-Party |
|----------|-----------|-------------|
| Core Cryptography | 9/10 | 9/10 |
| Challenge/Response | 8/10 | 8/10 |
| Secret Management | 4/10 | 9/10 | ← Gap |
| Rate Limiting (Distributed) | 4/10 | 9/10 | ← Gap |
| Counter Replay Detection | 5/10 | 8/10 | ← Gap |
| Attestation Validation | 2/10 | 8/10 | ← Gap |
| Email Verification | 2/10 | 8/10 | ← Gap |
| Device Anomaly Detection | 1/10 | 8/10 | ← Gap |
| Revocation/Session Mgmt | 3/10 | 8/10 | ← Gap |
| Audit Logging | 1/10 | 8/10 | ← Gap |
| **OVERALL** | **6.5/10** | **8.5/10** | |

---

## IMPROVEMENT ROADMAP

### 🔴 Priority 1: CRITICAL (Do First - 2.3 point gain)
- Implement HMAC secret rotation (+1.0) - 2 hours
- Move to secret vault (AWS Secrets Manager) (+0.5) - 3 hours
- Move rate limiting to Redis (+0.8) - 4 hours
- **Result: 6.5 → 8.8/10** ⭐

### 🟠 Priority 2: HIGH (Strongly Recommended - 1.5 point gain)
- Add backwards counter detection (+0.6) - 2 hours
- Implement audit logging (+0.5) - 4 hours
- Require attestation validation (+0.4) - 1 hour

### 🟡 Priority 3: MEDIUM (Nice to Have - 1.2 point gain)
- Add email verification (+0.3) - 3 hours
- Implement GeoIP checks (+0.4) - 4 hours
- Add device management UI (+0.5) - 6 hours

---

## RECOMMENDATION BY USE CASE

### ✅ USE SELF-HOSTED IF:
- Single-instance, single-region deployment
- You need complete audit trail & control
- Running internal/enterprise system
- You're willing to implement Priority 1 fixes
- You understand the security tradeoffs
- You have ops resources for maintenance

### ✅ USE THIRD-PARTY IF:
- Multi-region or distributed deployment
- Handling sensitive data (medical, financial)
- Need SOC2/HIPAA compliance
- Don't have ops resources
- Want someone else responsible for security

### 🔴 DO NOT USE SELF-HOSTED WITHOUT FIXES:
- Financial/payment systems
- Healthcare/medical records
- Critical infrastructure
- Systems that must survive breaches
- Without implementing Priority 1 fixes

---

## SUMMARY

Your self-hosted system is **6-7/10 secure** right now. It's suitable for:
- **Low-risk applications** (personal projects, non-critical systems)
- **Single-instance deployments**
- **Systems where you need full control**

If you implement Priority 1 fixes (secret rotation, Redis, sealed vault), it becomes **8.8/10** and suitable for most production use cases.

The gap vs third-party services is primarily **operational** (secrets management, monitoring, incident response) not **cryptographic** (the core WebAuthn is equally secure).
