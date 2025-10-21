# Passkey Management - Quick Start & Examples

## Quick API Reference

### 1. List All Passkeys
```bash
curl "http://localhost:3000/api/webauthn/passkeys/list?email=user@example.com"
```

Response:
```json
{
  "passkeys": [
    {
      "id": "credentialId_123",
      "name": "iPhone 15",
      "createdAt": 1702977904000,
      "lastUsedAt": 1702990000000,
      "status": "active"
    },
    {
      "id": "credentialId_456",
      "name": "Work Laptop",
      "createdAt": 1702900000000,
      "lastUsedAt": 1702988000000,
      "status": "active"
    }
  ]
}
```

### 2. Register & Name a Passkey
```typescript
// Step 1: Register passkey (existing flow)
const result = await fetch('/api/webauthn/register/verify', {
  method: 'POST',
  body: JSON.stringify({ email, assertion, challenge, challengeToken })
});

// Get user's passkeys to find the new one
const list = await fetch(`/api/webauthn/passkeys/list?email=${email}`)
  .then(r => r.json());

const newPasskey = list.passkeys[list.passkeys.length - 1];

// Step 2: Immediately rename
await fetch('/api/webauthn/passkeys/rename', {
  method: 'POST',
  body: JSON.stringify({
    email,
    credentialId: newPasskey.id,
    name: 'My iPhone'
  })
});
```

### 3. Rename Passkey
```bash
curl -X POST http://localhost:3000/api/webauthn/passkeys/rename \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "credentialId": "credentialId_123",
    "name": "iPhone 15 Pro"
  }'
```

Response:
```json
{ "success": true }
```

### 4. Delete Passkey
```bash
curl -X POST http://localhost:3000/api/webauthn/passkeys/delete \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "credentialId": "credentialId_123"
  }'
```

### 5. Disable Passkey (Soft Delete)
```bash
curl -X POST http://localhost:3000/api/webauthn/passkeys/disable \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "credentialId": "credentialId_123"
  }'
```

---

## JavaScript/TypeScript Examples

### Show Passkey List to User
```typescript
async function displayPasskeyList(email: string) {
  const response = await fetch(`/api/webauthn/passkeys/list?email=${encodeURIComponent(email)}`);
  const data = await response.json();

  console.log('Your Passkeys:');
  console.log('==============');
  
  data.passkeys.forEach((pk, index) => {
    const created = new Date(pk.createdAt).toLocaleDateString();
    const lastUsed = pk.lastUsedAt 
      ? new Date(pk.lastUsedAt).toLocaleDateString()
      : 'Never';
    
    const statusIcon = pk.status === 'active' ? '✓' : '⚠️';
    
    console.log(`${index + 1}. ${pk.name} ${statusIcon}`);
    console.log(`   Created: ${created}`);
    console.log(`   Last used: ${lastUsed}`);
    console.log(`   Status: ${pk.status}`);
  });
}
```

### Rename Passkey
```typescript
async function renamePasskey(email: string, credentialId: string, newName: string) {
  try {
    const response = await fetch('/api/webauthn/passkeys/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, credentialId, name: newName })
    });
    
    if (response.ok) {
      console.log(`✓ Passkey renamed to "${newName}"`);
    } else {
      const error = await response.json();
      console.error(`✗ Error: ${error.error}`);
    }
  } catch (err) {
    console.error('Network error:', err);
  }
}
```

### Delete Passkey with Confirmation
```typescript
async function deletePasskey(email: string, credentialId: string) {
  const confirm = window.confirm(
    'Are you sure? You will not be able to use this passkey to sign in.'
  );
  
  if (!confirm) return;

  try {
    const response = await fetch('/api/webauthn/passkeys/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, credentialId })
    });
    
    if (response.ok) {
      console.log('✓ Passkey deleted');
      // Refresh list
      displayPasskeyList(email);
    } else {
      const error = await response.json();
      if (error.error.includes('last passkey')) {
        alert('This is your only passkey. Add another auth method first.');
      } else {
        alert(`Error: ${error.error}`);
      }
    }
  } catch (err) {
    console.error('Network error:', err);
  }
}
```

### Handle Compromised Passkey
```typescript
async function handleCompromisedPasskey(email: string) {
  const response = await fetch(`/api/webauthn/passkeys/list?email=${encodeURIComponent(email)}`);
  const data = await response.json();
  
  const compromised = data.passkeys.filter(pk => pk.status === 'compromised');
  
  if (compromised.length > 0) {
    compromised.forEach(pk => {
      console.warn(`⚠️ Security Alert: ${pk.name} has been marked as compromised.`);
      console.warn(`Last used: ${new Date(pk.lastUsedAt).toLocaleString()}`);
      console.warn('We recommend disabling or deleting it.');
    });
    
    // Offer to disable
    const disable = window.confirm('Would you like to disable this passkey?');
    if (disable) {
      await fetch('/api/webauthn/passkeys/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, credentialId: compromised[0].id })
      });
      console.log('✓ Passkey disabled');
    }
  }
}
```

### Post-Registration Naming
```typescript
async function registerAndNamePasskey(email: string, deviceName: string) {
  // Step 1: Run standard registration flow
  const challenge = await generateChallenge(email);
  
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: new TextEncoder().encode(challenge),
      rp: { name: 'My App' },
      user: {
        id: new TextEncoder().encode(email),
        name: email,
        displayName: email
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      timeout: 60000
    }
  });

  // Step 2: Send for verification
  const result = await fetch('/api/webauthn/register/verify', {
    method: 'POST',
    body: JSON.stringify({
      email,
      assertion: credential,
      challenge,
      challengeToken
    })
  });

  if (!result.ok) {
    throw new Error('Registration failed');
  }

  // Step 3: Get passkeys to find the new one
  const list = await fetch(`/api/webauthn/passkeys/list?email=${email}`)
    .then(r => r.json());

  const newPasskey = list.passkeys[list.passkeys.length - 1];

  // Step 4: Rename immediately
  await fetch('/api/webauthn/passkeys/rename', {
    method: 'POST',
    body: JSON.stringify({
      email,
      credentialId: newPasskey.id,
      name: deviceName
    })
  });

  console.log(`✓ Passkey registered and named "${deviceName}"`);
  return newPasskey;
}

// Usage:
await registerAndNamePasskey('user@example.com', 'My iPhone 15');
```

---

## React Component Examples

### Passkey List Component
```tsx
import { useState, useEffect } from 'react';

export function PasskeyList({ email }: { email: string }) {
  const [passkeys, setPasskeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    loadPasskeys();
  }, [email]);

  async function loadPasskeys() {
    try {
      const res = await fetch(`/api/webauthn/passkeys/list?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      setPasskeys(data.passkeys);
    } catch (err) {
      console.error('Failed to load passkeys', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRename(credentialId: string) {
    if (!newName.trim()) return;

    try {
      const res = await fetch('/api/webauthn/passkeys/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, credentialId, name: newName })
      });

      if (res.ok) {
        setRenaming(null);
        setNewName('');
        loadPasskeys();
      }
    } catch (err) {
      console.error('Rename failed', err);
    }
  }

  async function handleDelete(credentialId: string) {
    if (!window.confirm('Delete this passkey?')) return;

    try {
      const res = await fetch('/api/webauthn/passkeys/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, credentialId })
      });

      if (res.ok) {
        loadPasskeys();
      } else {
        const err = await res.json();
        alert(`Cannot delete: ${err.error}`);
      }
    } catch (err) {
      console.error('Delete failed', err);
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div className="passkey-list">
      <h2>Your Passkeys</h2>
      {passkeys.length === 0 ? (
        <p>No passkeys yet. Add one to get started.</p>
      ) : (
        <div className="passkeys">
          {passkeys.map(pk => (
            <div key={pk.id} className={`passkey ${pk.status}`}>
              <div className="name">
                {renaming === pk.id ? (
                  <input
                    autoFocus
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onBlur={() => handleRename(pk.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename(pk.id);
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                  />
                ) : (
                  <>
                    <span>{pk.name}</span>
                    {pk.status === 'compromised' && <span className="badge">⚠️ Compromised</span>}
                    {pk.status === 'disabled' && <span className="badge">🔒 Disabled</span>}
                  </>
                )}
              </div>
              <div className="dates">
                <small>Created: {new Date(pk.createdAt).toLocaleDateString()}</small>
                <small>Last used: {pk.lastUsedAt ? new Date(pk.lastUsedAt).toLocaleDateString() : 'Never'}</small>
              </div>
              <div className="actions">
                {renaming !== pk.id && (
                  <>
                    <button onClick={() => {
                      setRenaming(pk.id);
                      setNewName(pk.name);
                    }}>
                      Rename
                    </button>
                    <button onClick={() => handleDelete(pk.id)} className="delete">
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Error Handling

### Common Errors and Solutions

**"Cannot delete the last passkey"**
- User needs another auth method
- Show message: "Add another way to sign in first"
- Suggest: Google OAuth, email/password, etc.

**"This passkey is disabled or has been marked as compromised"**
- During authentication
- User should try another passkey
- Show: "Try a different passkey" or "Add a new passkey"

**"Passkey not found"**
- Credential ID doesn't exist
- List may be out of sync
- Refresh and retry

---

## Data Format Reference

### Passkey Metadata Object
```typescript
{
  id: string;              // Credential ID (base64url)
  name: string;           // User-friendly name (max 50 chars)
  createdAt: number;      // Timestamp (milliseconds)
  lastUsedAt: number | null; // Timestamp or null if never used
  status: 'active' | 'disabled' | 'compromised';
}
```

### Timestamps
```typescript
const created = new Date(passkey.createdAt);
const lastUsed = passkey.lastUsedAt ? new Date(passkey.lastUsedAt) : null;
const daysSinceCreation = Math.floor((Date.now() - passkey.createdAt) / 86400000);
const daysSinceUsed = passkey.lastUsedAt ? Math.floor((Date.now() - passkey.lastUsedAt) / 86400000) : Infinity;
```

---

**See PASSKEY_MANAGEMENT.md for complete reference.**
