
╔════════════════════════════════════════════════════════════════════════════╗
║           MULTI-PASSKEY ARCHITECTURE - VISUAL EXPLANATION                 ║
╚════════════════════════════════════════════════════════════════════════════╝

CURRENT STATE: FULLY WORKING ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━

User: Alice

Appwrite Prefs Storage:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  passkey_credentials: {                                         │
│    "credId_iPhone":    "publicKey_iPhone",                     │
│    "credId_Laptop":    "publicKey_Laptop",                     │
│    "credId_SecurityKey": "publicKey_SecurityKey"               │
│  }                                                              │
│                                                                 │
│  passkey_counter: {                                            │
│    "credId_iPhone":    5,                                      │
│    "credId_Laptop":    12,                                     │
│    "credId_SecurityKey": 8                                     │
│  }                                                              │
│                                                                 │
│  passkey_counter_history: {                                    │
│    "credId_iPhone": [                                          │
│      { timestamp: ..., counter: 5 },                           │
│      { timestamp: ..., counter: 4 }                            │
│    ],                                                           │
│    "credId_Laptop": [...],                                     │
│    "credId_SecurityKey": [...]                                 │
│  }                                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

REGISTRATION FLOW: Adding Passkey ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Alice has 1 passkey (iPhone), wants to add Laptop:

Step 1: Generate Options
  POST /api/webauthn/register/options
  └─ Server: Create challenge
  └─ Return: WebAuthn options

Step 2: Create Credential
  Browser (Laptop):
  └─ navigator.credentials.create()
  └─ Create passkey on laptop

Step 3: Verify & Store
  POST /api/webauthn/register/verify
  │
  Server:
  ├─ Parse existing: { credId_iPhone: publicKeyA }
  ├─ Verify new credential
  ├─ Extract: credId_Laptop = publicKeyB
  ├─ MERGE into one object:
  │  {
  │    credId_iPhone: publicKeyA,      ← PRESERVED
  │    credId_Laptop: publicKeyB       ← ADDED
  │  }
  ├─ Store back to prefs
  └─ Result: ✅ Now has 2 passkeys

NEW STATE:
  passkey_credentials: {
    "credId_iPhone": "publicKeyA",
    "credId_Laptop": "publicKeyB"     ← NEW
  }


AUTHENTICATION FLOW: Using Passkey ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Alice has 3 passkeys, signs in with Laptop:

Step 1: Get Options
  GET /api/webauthn/auth/options?email=alice@...
  │
  Server:
  ├─ Get ALL credentials: { credId_iPhone, credId_Laptop, credId_SecurityKey }
  ├─ Create challenge
  └─ Return: allowCredentials = [all 3 IDs]

Step 2: Browser Shows Options
  Device (Laptop):
  │
  Browser:
  ├─ Display: "Touch your passkey"
  ├─ Available:
  │  ├─ Passkey on iPhone (mobile)
  │  ├─ Passkey on this Laptop (this device) ← User touches here
  │  └─ Security Key (external)
  │
  User:
  └─ Touches Laptop passkey

Step 3: Authenticate
  POST /api/webauthn/auth/verify
  │
  Request contains:
  ├─ assertion.id = "credId_Laptop"  ← Client tells us WHICH key
  ├─ assertion.clientDataJSON = ...
  └─ assertion.authenticatorData = ...
  │
  Server:
  ├─ Extract credentialId = "credId_Laptop"
  ├─ Look up: publicKey = credObj["credId_Laptop"]
  ├─ Get counter: counterObj["credId_Laptop"] = 12
  ├─ Verify ONLY this credential:
  │  ├─ Signature check
  │  ├─ Challenge check
  │  └─ Counter check
  ├─ Update ONLY this counter: 12 → 13
  ├─ OTHER counters unchanged:
  │  ├─ credId_iPhone: 5 (still 5)
  │  ├─ credId_Laptop: 12 → 13 ✓
  │  └─ credId_SecurityKey: 8 (still 8)
  │
  Result:
  ├─ ✅ Session token returned
  ├─ ✅ iPhone passkey: Ready for next use
  └─ ✅ SecurityKey passkey: Ready for next use


CLONE DETECTION: Per-Passkey ✅
━━━━━━━━━━━━━━━━━━━━━━━━━

Attacker steals iPhone passkey (credId_iPhone)

Scenario:
├─ Server's view: credId_iPhone counter = 5
├─ Attacker clones it to device: counter = 5 (same)
├─ Legitimate user uses iPhone first
│  ├─ Counter: 5 → 6
│  └─ Server: ✅ "Expected 6, got 6" VERIFIED
├─ Attacker tries to use clone
│  ├─ Counter: 5 (unchanged)
│  └─ Server: ❌ "Expected 7, got 5" DETECTED!
│  └─ Error: "Potential passkey compromise detected"
│
Other passkeys UNAFFECTED:
├─ Laptop passkey: Still works normally
├─ SecurityKey: Still works normally
└─ Only iPhone marked as compromised


SELECTION: How Client Chooses Passkey
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Registration (Adding):
  User/Device: Adds new passkey
  Server: Stores with auto-generated credentialId
  Result: Each passkey has unique ID

Authentication (Using):
  Server: Returns list of all valid credentialIds
  Browser: Shows available passkeys
  Device: User touches ONE passkey
  Device: Sends assertion with that credentialId
  Server: Looks up that specific ID
  Server: Verifies only that passkey
  Result: Selected passkey authenticated


CURRENT STATE vs NEEDED
━━━━━━━━━━━━━━━━━━━━

✅ WORKS:
├─ Register passkey
├─ Register MORE passkeys
├─ Authenticate with ANY passkey
├─ Track each separately
├─ Detect cloned passkey
└─ Per-passkey counter

❌ MISSING:
├─ See your passkeys with names
├─ Name them ("iPhone", "Laptop")
├─ Delete specific one
├─ Disable one temporarily
├─ See when created
├─ See when last used
└─ Manage them


PROPOSED ENHANCEMENT: Metadata
━━━━━━━━━━━━━━━━━━━━━━━━

ADD new pref: passkey_metadata

Current:
  passkey_credentials: {
    "credId_iPhone": "publicKey..."
  }

Enhanced:
  passkey_credentials: {
    "credId_iPhone": "publicKey..."
  }
  
  passkey_metadata: {              ← NEW
    "credId_iPhone": {
      "name": "iPhone 15",
      "createdAt": 1702977904000,
      "lastUsedAt": 1702990000000,
      "status": "active",          // active | disabled | compromised
      "deviceType": "mobile"
    },
    "credId_Laptop": {
      "name": "MacBook Pro",
      "createdAt": 1702900000000,
      "lastUsedAt": 1702988000000,
      "status": "active",
      "deviceType": "desktop"
    }
  }


NEW CAPABILITIES: With Metadata
━━━━━━━━━━━━━━━━━━━━━━━━

User Interface:
  "Your Passkeys"
  ┌──────────────────────────────────┐
  │ iPhone 15              [Delete]   │
  │ Created: Jan 15, 2024            │
  │ Last used: 1 hour ago            │
  └──────────────────────────────────┘
  ┌──────────────────────────────────┐
  │ MacBook Pro            [Delete]   │
  │ Created: Jan 1, 2024             │
  │ Last used: Yesterday             │
  └──────────────────────────────────┘
  ┌──────────────────────────────────┐
  │ Security Key ⚠ Compromised      │
  │ Created: Dec 20, 2023            │
  │ Status: Disabled (clone detected) │
  └──────────────────────────────────┘


DECISION
━━━━━━

Current State: ✅ COMPLETE MULTI-PASSKEY SUPPORT
Gap: User management (optional but nice)
Solution: Add metadata (backward compatible)
Impact: ZERO breaking changes, purely additive

Implement? → YES ✅
