# Passkey Management System - Complete Implementation

## ✅ What's New

Full passkey management with metadata tracking. Users can now:
- ✅ List their passkeys with names and dates
- ✅ Name passkeys (e.g., "iPhone", "Work Laptop")
- ✅ See when each passkey was created
- ✅ See when each passkey was last used
- ✅ Disable passkeys (soft delete)
- ✅ Delete passkeys permanently
- ✅ Full audit trail stored in metadata

## Backward Compatible

✅ Existing passkeys work without changes
✅ No breaking changes to auth flows
✅ Metadata auto-created when missing
✅ Old passkeys auto-migrated on first use

---

## Storage Structure

New pref added to Appwrite user prefs:

```typescript
passkey_metadata: {
  "credentialId1": {
    "name": "iPhone 15",
    "createdAt": 1702977904000,    // Timestamp
    "lastUsedAt": 1702990000000,   // Timestamp or null
    "status": "active"             // active | disabled | compromised
  },
  "credentialId2": {
    "name": "Work Laptop",
    "createdAt": 1702900000000,
    "lastUsedAt": 1702988000000,
    "status": "active"
  }
}
```

---

## New Server Methods

### listPasskeysWithMetadata(email)
List all passkeys for user with full metadata.

```typescript
const passkeys = await server.listPasskeysWithMetadata('user@example.com');
// Returns:
// [
//   {
//     id: "credentialId1",
//     name: "iPhone 15",
//     createdAt: 1702977904000,
//     lastUsedAt: 1702990000000,
//     status: "active"
//   },
//   ...
// ]
```

### getPasskeyInfo(email, credentialId)
Get details of a single passkey.

```typescript
const info = await server.getPasskeyInfo('user@example.com', 'credentialId1');
// Returns same format as above
```

### renamePasskey(email, credentialId, newName)
Rename a passkey to a user-friendly name.

```typescript
await server.renamePasskey('user@example.com', 'credentialId1', 'My Phone');
// Max 50 characters
```

### deletePasskey(email, credentialId)
Permanently delete a passkey.

```typescript
await server.deletePasskey('user@example.com', 'credentialId1');
// Removes from credentials, counter, and metadata
// Fails if it's the only passkey
```

### disablePasskey(email, credentialId)
Disable a passkey (soft delete). Can be re-enabled.

```typescript
await server.disablePasskey('user@example.com', 'credentialId1');
// Sets status = "disabled"
// Passkey cannot be used but is not deleted
```

### updatePasskeyLastUsed(email, credentialId)
Automatically called after successful authentication. Updates `lastUsedAt` timestamp.

```typescript
await server.updatePasskeyLastUsed('user@example.com', 'credentialId1');
```

### markPasskeyCompromised(email, credentialId)
Automatically called when counter regression detected (cloned passkey). Sets status to "compromised".

```typescript
await server.markPasskeyCompromised('user@example.com', 'credentialId1');
```

### isPasskeyAvailable(credentialId, metadataStr)
Check if passkey is available (not disabled/compromised).

```typescript
const available = await server.isPasskeyAvailable('credentialId1', metadataStr);
// Returns boolean
```

---

## API Endpoints

### GET /api/webauthn/passkeys/list
List all user's passkeys with metadata.

**Query:**
```
email=user@example.com
```

**Response:**
```json
{
  "passkeys": [
    {
      "id": "credentialId1",
      "name": "iPhone 15",
      "createdAt": 1702977904000,
      "lastUsedAt": 1702990000000,
      "status": "active"
    }
  ]
}
```

### POST /api/webauthn/passkeys/rename
Rename a passkey.

**Body:**
```json
{
  "email": "user@example.com",
  "credentialId": "credentialId1",
  "name": "My iPhone"
}
```

**Response:**
```json
{ "success": true }
```

### POST /api/webauthn/passkeys/delete
Delete a passkey permanently.

**Body:**
```json
{
  "email": "user@example.com",
  "credentialId": "credentialId1"
}
```

**Response:**
```json
{ "success": true }
```

**Error (last passkey):**
```json
{
  "error": "Cannot delete the last passkey. Add another auth method first."
}
```

### POST /api/webauthn/passkeys/disable
Disable a passkey (soft delete).

**Body:**
```json
{
  "email": "user@example.com",
  "credentialId": "credentialId1"
}
```

**Response:**
```json
{ "success": true }
```

---

## Integration Points

### 1. After Registration
Metadata automatically created with:
- `name`: "Passkey {date}"
- `createdAt`: Current timestamp
- `lastUsedAt`: null
- `status`: "active"

**Immediate naming (right after registration):**
```typescript
// After registerPasskey returns, call:
await server.renamePasskey(email, credentialId, 'My Device Name');
```

### 2. After Authentication
- `lastUsedAt` automatically updated
- `status` checked (must be "active")

### 3. After Counter Regression (Clone Detected)
- Status automatically set to "compromised"
- Error message: "Potential passkey compromise detected..."

---

## Usage Examples

### List All Passkeys
```typescript
const passkeys = await server.listPasskeysWithMetadata('user@example.com');

passkeys.forEach(pk => {
  console.log(`${pk.name} - Created: ${new Date(pk.createdAt).toLocaleDateString()}`);
  console.log(`Last used: ${pk.lastUsedAt ? new Date(pk.lastUsedAt).toLocaleDateString() : 'Never'}`);
  console.log(`Status: ${pk.status}`);
});
```

### Register and Name
```typescript
// 1. Register passkey
const result = await server.registerPasskey(email, credentialData, challenge);

// 2. Extract credentialId from prefs
const passkeys = await server.listPasskeysWithMetadata(email);
const newPasskey = passkeys[passkeys.length - 1]; // Last one added

// 3. Immediately rename
await server.renamePasskey(email, newPasskey.id, 'iPhone 15 Pro');

console.log('Passkey registered and named!');
```

### Disable Compromised Passkey
```typescript
// After counter regression is detected
const info = await server.getPasskeyInfo(email, credentialId);
if (info.status === 'compromised') {
  console.log(`Passkey "${info.name}" has been compromised.`);
  console.log(`Last used: ${new Date(info.lastUsedAt).toLocaleString()}`);
}
```

### Delete Old Passkey
```typescript
try {
  await server.deletePasskey(email, credentialId);
  console.log('Passkey deleted');
} catch (err) {
  console.log('Cannot delete - is it your only passkey?');
  // Offer to add another auth method first
}
```

---

## Data Lifetime

### Created
- Automatically when passkey registered
- Auto-named: "Passkey {date}"

### Updated
- `lastUsedAt`: After every successful authentication
- `name`: When user renames
- `status`: When compromised/disabled/recovered

### Preserved
- All data when adding new passkey
- Counter history maintained independently
- No data loss

### Retained
- Up to 50 counter history entries per passkey
- All metadata indefinitely
- Full audit trail of timestamps

---

## Backward Compatibility

### For Old Passkeys (Without Metadata)
```typescript
// First time old passkey is accessed:
// 1. Check if metadata exists
// 2. If missing, auto-create with defaults
// 3. Continue normally
// Result: No data loss, seamless upgrade
```

### For New Users
```typescript
// Metadata automatically created on registration
// No additional steps needed
```

### For Existing Deployments
```typescript
// No migration script needed
// Metadata lazily created on first use
// Zero downtime
```

---

## Security Notes

✅ **No Account Takeover**
- Metadata doesn't affect auth logic
- Only marks status, doesn't prevent legitimate users

✅ **Counter Detection**
- Clone detection automatically marks as compromised
- User informed immediately
- Compromised key blocks future auth attempts

✅ **Soft Delete**
- Disable feature for recovery scenarios
- Data not lost, just marked as disabled
- Can be permanently deleted later

✅ **Last Passkey Protection**
- Cannot delete if it's the only auth method
- Forces user to add backup auth first
- Prevents accidental lockout

---

## Audit Trail

Complete history available via metadata:

```typescript
const info = await server.getPasskeyInfo(email, credentialId);

console.log({
  name: info.name,
  created: new Date(info.createdAt).toISOString(),
  lastUsed: info.lastUsedAt ? new Date(info.lastUsedAt).toISOString() : null,
  status: info.status,
  daysOld: Math.floor((Date.now() - info.createdAt) / 86400000),
  daysSinceUsed: info.lastUsedAt ? Math.floor((Date.now() - info.lastUsedAt) / 86400000) : null
});
```

---

## Client Usage Pattern

```typescript
// 1. Show list of passkeys
const passkeys = await fetch('/api/webauthn/passkeys/list?email=' + email)
  .then(r => r.json());

// 2. Display with UI
passkeys.passkeys.forEach(pk => {
  const status = pk.status === 'compromised' ? '⚠️' : '✓';
  console.log(`${status} ${pk.name}`);
});

// 3. Rename action
await fetch('/api/webauthn/passkeys/rename', {
  method: 'POST',
  body: JSON.stringify({ email, credentialId, name: 'New Name' })
});

// 4. Delete action
await fetch('/api/webauthn/passkeys/delete', {
  method: 'POST',
  body: JSON.stringify({ email, credentialId })
});
```

---

## Files

**Server Methods:**
- `lib/passkey-server.ts` (added ~280 lines)

**API Endpoints:**
- `app/api/webauthn/passkeys/list/route.ts`
- `app/api/webauthn/passkeys/rename/route.ts`
- `app/api/webauthn/passkeys/delete/route.ts`
- `app/api/webauthn/passkeys/disable/route.ts`

**Updated Files:**
- `lib/passkey-server.ts` - registerPasskey now creates metadata
- `lib/passkey-server.ts` - authenticatePasskey now updates lastUsedAt
- `lib/passkey-server.ts` - authenticatePasskey blocks compromised keys

---

## Status

✅ Implementation: COMPLETE
✅ Backward Compatible: YES
✅ No Breaking Changes: YES
✅ API Endpoints: READY
✅ Audit Trail: ENABLED
✅ Clone Detection: INTEGRATED
✅ Build: PASSES

---

## Next Steps for UI

Suggested features to build:

1. **Passkey List Screen**
   - Show all passkeys with names
   - Display creation and last used dates
   - Status indicators (active/disabled/compromised)

2. **Rename Dialog**
   - Text input for passkey name
   - Call POST /api/webauthn/passkeys/rename

3. **Delete Confirmation**
   - Confirm user identity
   - Show passkey name
   - Call POST /api/webauthn/passkeys/delete

4. **Post-Registration Naming**
   - After successful registration
   - Prompt: "Name this passkey?"
   - Auto-call rename endpoint

5. **Compromise Handling**
   - Detect status = "compromised"
   - Show warning banner
   - Offer: Disable or Delete
   - Suggest adding new passkey

---

**Ready for UI integration!**
