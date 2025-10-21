# Multi-Passkey Architecture Analysis & Enhancement

## Current State Analysis

### ✅ What Works (Multi-Passkey Support is Implemented)

The system **DOES fully support multiple passkeys** per user:

#### 1. Storage Structure (Appwrite Prefs)
```typescript
passkey_credentials: {
  "credentialId1": "base64url_publicKey1",
  "credentialId2": "base64url_publicKey2",
  "credentialId3": "base64url_publicKey3"
}

passkey_counter: {
  "credentialId1": 5,
  "credentialId2": 12,
  "credentialId3": 8
}

passkey_counter_history: {
  "credentialId1": [
    { "timestamp": 1702977904, "counter": 5 },
    { "timestamp": 1702977890, "counter": 4 }
  ],
  "credentialId2": [...]
}
```

#### 2. Registration (Adding Passkeys)
```typescript
// registerPasskey() method (lines 59-127)

1. Verify credential doesn't exist yet
2. Verify registration response
3. Parse existing credentials map
4. ADD new credential to map (line 107)
   credObj[passkeyData.id] = passkeyData.publicKey;
5. Update prefs with MERGED credentials (all passkeys preserved)
6. Return session token
```

✅ **Supports unlimited passkeys per user**
✅ **Preserves existing passkeys when adding new ones**
✅ **Each passkey stored with its own counter**

#### 3. Authentication (Using Passkeys)
```typescript
// authenticatePasskey() method (lines 129-230)

1. Get ALL credentials from prefs
2. Client sends assertion with credentialId
3. Server finds matching credential by ID (line 151-152)
   const credentialId = assertion.rawId || assertion.id;
   const publicKey = credObj[credentialId];
4. Verify only that specific credential
5. Update only that credential's counter
6. Return session token
```

✅ **Client sends which passkey it's using (credentialId in assertion)**
✅ **Server finds matching passkey by ID**
✅ **Each passkey authenticated independently**

#### 4. Passkey Retrieval
```typescript
// getPasskeysByEmail() method (lines 233-239)

Returns ALL passkeys for user:
[
  { id: "credId1", publicKey: "...", counter: 0 },
  { id: "credId2", publicKey: "...", counter: 0 },
  { id: "credId3", publicKey: "...", counter: 0 }
]
```

✅ **Returns all passkeys (for UI to show user)**

---

## ✅ Current Capabilities

### Multi-Passkey Registration
- ✅ Add first passkey → stored
- ✅ Add second passkey → added to existing credentials map
- ✅ Add third passkey → all previous preserved
- ✅ No limit on how many passkeys per user

### Multi-Passkey Authentication
- ✅ User's device selects which passkey to use
- ✅ Device sends credentialId in assertion
- ✅ Server looks up that specific credential
- ✅ Server verifies only that credential
- ✅ Counter updated only for that credential
- ✅ Other credentials untouched

### Per-Passkey Tracking
- ✅ Each passkey has own counter
- ✅ Each passkey has counter history
- ✅ Cloned passkey detection per credential
- ✅ Independent compromise detection

---

## 🔄 Multi-Passkey Flow Explained

### Scenario 1: User Has Multiple Devices

```
User with 2 passkeys:
├─ Passkey A (iPhone)
└─ Passkey B (Laptop)

Sign-in attempt:
├─ User: "I want to sign in"
├─ Server: "Which passkey? Here are your options..."
├─ User chooses: Passkey B (touch laptop)
├─ Server receives:
│  ├─ credentialId: "credentialIdB"
│  ├─ assertion: {...}
│  └─ challenge: "..."
├─ Server:
│  ├─ Look up "credentialIdB" → Found!
│  ├─ Get publicKey for B
│  ├─ Verify assertion
│  ├─ Update counter for B only
│  ├─ Passkey A counter unchanged
│  └─ Return session token
```

### Scenario 2: Adding Another Passkey

```
User already has Passkey A on iPhone

Wants to add Passkey B on Laptop:

POST /api/webauthn/register/options
├─ Server generates challenge

Browser (Laptop):
├─ Create Passkey B
├─ Send registration response

POST /api/webauthn/register/verify
├─ Server:
│  ├─ Get existing credentials
│  │  └─ { "credId_A": "publicKeyA" }
│  ├─ Register new credential B
│  │  └─ credId_B: "publicKeyB"
│  ├─ Merge into single map
│  │  ├─ credId_A: "publicKeyA"
│  │  └─ credId_B: "publicKeyB" ← NEW
│  ├─ Store to prefs
│  └─ Return session
```

### Scenario 3: Cloned Passkey Detection

```
User has 2 passkeys:
├─ Passkey A (counter=5)
└─ Passkey B (counter=3)

Attacker steals Passkey A, uses it elsewhere
├─ Legitimate user: Uses Passkey A
│  ├─ Counter should be 6
│  └─ Server: All good!
├─ Attacker: Uses stolen Passkey A on another device
│  ├─ Counter is 5 (from clone)
│  ├─ Server receives counter=5
│  └─ Expected was 6
│  └─ Server: DETECTED! Counter regression!
│  └─ Server: Blocks access, alerts user
```

---

## 🚨 Current Gaps (What Needs Enhancement)

While multi-passkey IS supported, there are gaps in **user management**:

### Gap 1: No Passkey Naming/Metadata
```typescript
// Current: Only stores public key and ID
passkey_credentials: {
  "credentialId1": "publicKey1",
  "credentialId2": "publicKey2"
}

// Problem: User doesn't know which is which!
// What does credentialId1 represent?
// - iPhone? Laptop? Security key?
// - Which user added it? When?
// User can't tell which to remove!
```

### Gap 2: No UI for Managing Passkeys
- ❌ No endpoint to list passkeys with names/dates
- ❌ No UI to show "You have 3 passkeys"
- ❌ No UI to remove specific passkey
- ❌ No UI to rename passkey
- ❌ No date of creation metadata

### Gap 3: Limited Passkey Info on Client
```typescript
// Current - returns minimal data
getPasskeysByEmail() returns: { id, publicKey, counter }

// Problem: Client doesn't know:
// - When was it created?
// - What device is it on?
// - Was it created by user or admin?
// - Is this the only passkey?
```

### Gap 4: No Safe Passkey Deletion
- ❌ No endpoint to delete specific passkey by ID
- ❌ Risk: Delete wrong passkey, lose access

### Gap 5: No Passkey Disabling
- ❌ Can't temporarily disable a passkey (e.g., after suspicious activity)
- ❌ Can't mark passkey as "compromised"

---

## ✅ What I'm Adding (Enhancements)

I'll add a **Passkey Management System** that:

1. **Enhanced Metadata Storage**
   - Passkey name/label (user-friendly)
   - Creation timestamp
   - Last used timestamp
   - Device type hint (if available)
   - Status (active/disabled/compromised)

2. **New Prefs Structure**
   ```typescript
   passkey_metadata: {
     "credentialId1": {
       "name": "iPhone",
       "createdAt": 1702977904,
       "lastUsedAt": 1702990000,
       "status": "active"
     }
   }
   ```

3. **New Server Methods**
   - `listPasskeysWithMetadata(email)` → All passkeys with details
   - `deletePasskey(email, credentialId)` → Remove specific passkey
   - `renamePasskey(email, credentialId, name)` → Update name
   - `disablePasskey(email, credentialId)` → Temporarily disable
   - `getPasskeyInfo(email, credentialId)` → Get details

4. **New Endpoints** (optional, can add UI later)
   - `GET /api/webauthn/passkeys` → List all user's passkeys
   - `DELETE /api/webauthn/passkeys/:credentialId` → Remove one
   - `PATCH /api/webauthn/passkeys/:credentialId` → Update metadata

5. **Validation**
   - ✅ Can't delete last passkey (unless other auth exists)
   - ✅ Can't delete non-existent passkey
   - ✅ Safe deletion (confirms action)

---

## Architecture: Current vs. Enhanced

### Current (Works but Limited)
```
Appwrite User Prefs:
├─ passkey_credentials: {"id1": "pk1", "id2": "pk2"}
├─ passkey_counter: {"id1": 5, "id2": 3}
└─ passkey_counter_history: {...}

Server Methods:
├─ registerPasskey() ✓
├─ authenticatePasskey() ✓
├─ getPasskeysByEmail() ✓
└─ (no management)

Client See:
├─ Can register
├─ Can authenticate
└─ ??? (no visibility into passkeys)
```

### Enhanced (Full Multi-Passkey Management)
```
Appwrite User Prefs:
├─ passkey_credentials: {"id1": "pk1", "id2": "pk2"}
├─ passkey_counter: {"id1": 5, "id2": 3}
├─ passkey_counter_history: {...}
└─ passkey_metadata: {           ← NEW
    "id1": {
      "name": "iPhone",
      "createdAt": 1702977904,
      "lastUsedAt": 1702990000,
      "status": "active"
    },
    "id2": {...}
  }

Server Methods:
├─ registerPasskey() ✓
├─ authenticatePasskey() ✓
├─ getPasskeysByEmail() ✓
├─ listPasskeysWithMetadata() ← NEW
├─ deletePasskey() ← NEW
├─ renamePasskey() ← NEW
├─ disablePasskey() ← NEW
└─ getPasskeyInfo() ← NEW

Client See:
├─ Can register
├─ Can authenticate
├─ View all passkeys with names ← NEW
├─ Delete specific passkey ← NEW
├─ Rename passkey ← NEW
└─ See when created/last used ← NEW
```

---

## Proposed Enhancement (What I'll Implement)

### 1. Enhanced Metadata Storage
Add `passkey_metadata` pref:
```typescript
passkey_metadata: {
  "credentialId": {
    "name": "iPhone 15",           // User-friendly name
    "createdAt": 1702977904,        // When registered
    "lastUsedAt": 1702990000,       // When last authenticated
    "status": "active",             // active | disabled | compromised
    "deviceType": "mobile"          // Optional hint
  }
}
```

### 2. New Server Methods (in PasskeyServer class)
```typescript
// List all passkeys with metadata
async listPasskeysWithMetadata(email: string)
  → Returns all passkeys + metadata

// Get single passkey details
async getPasskeyInfo(email: string, credentialId: string)
  → Returns specific passkey + metadata

// Delete passkey
async deletePasskey(email: string, credentialId: string, reason?: string)
  → Removes credential + metadata
  → Validates not removing last passkey without backup auth

// Rename passkey
async renamePasskey(email: string, credentialId: string, name: string)
  → Updates metadata.name

// Disable passkey (soft delete)
async disablePasskey(email: string, credentialId: string)
  → Sets status to "disabled"
  → Still stored but can't authenticate

// Auto-update last used
async updatePasskeyLastUsed(email: string, credentialId: string)
  → Called after successful auth

// Check if passkey is available (not disabled/compromised)
async isPasskeyAvailable(credentialId: string)
  → Checks metadata.status
```

### 3. Integration Points
- After successful auth: Update `lastUsedAt`
- After registration: Create metadata with defaults
- On counter regression: Set status to "compromised"
- On deletion: Remove from both credentials and metadata

### 4. Backward Compatibility
- ✅ Old passkeys without metadata still work
- ✅ Metadata lazily created if missing
- ✅ No breaking changes to existing API
- ✅ Existing passkeys continue functioning

---

## Benefits of Enhancement

### For Users
✅ See which passkey is which (device name)
✅ Know when passkey was created
✅ See when passkey was last used
✅ Remove specific passkey (not all)
✅ Rename passkey for clarity
✅ Recover from accidental deletion (soft delete)

### For Security
✅ Track all passkeys and usage
✅ Detect suspicious activity
✅ Temporarily disable compromised passkey
✅ Complete audit trail
✅ Prevent accidental loss of access

### For Developers
✅ Full passkey lifecycle management
✅ User-friendly management endpoints
✅ Audit logging capability
✅ Clear API for passkey operations
✅ Extensible metadata structure

---

## Implementation Plan

### Phase 1: Storage Enhancement (This)
- [x] Design metadata structure
- [ ] Add `passkey_metadata` pref handling
- [ ] Migration support (old passkeys auto-migrate)

### Phase 2: Core Methods
- [ ] Implement server methods
- [ ] Add validation logic
- [ ] Add error handling

### Phase 3: Endpoints (Optional)
- [ ] Create API endpoints
- [ ] Add authorization checks
- [ ] Add rate limiting

### Phase 4: UI (Separate)
- [ ] Display passkeys
- [ ] Add rename/delete buttons
- [ ] Show metadata

---

## Summary: Current State ✅

**Multi-Passkey Support: ✅ FULLY IMPLEMENTED**
- Multiple passkeys per user: ✓
- Independent authentication: ✓
- Per-passkey counter tracking: ✓
- Cloned passkey detection per key: ✓

**Gap: User Management ❌ NOT IMPLEMENTED**
- Listing passkeys: ✗ (no metadata)
- Managing passkeys: ✗ (can't delete specific one)
- Understanding passkeys: ✗ (no names/dates)

**Solution: Add Passkey Management System**
- Enhanced metadata storage
- Management endpoints
- User-friendly operations
- Full audit trail

---

## Next Step

Shall I implement the enhancement?
- [ ] Add metadata structure
- [ ] Implement server methods
- [ ] Create admin endpoints
- [ ] Add documentation

This won't break anything - it's purely additive!

---

**Status**: Analysis complete. Ready to implement enhancement if you approve.
