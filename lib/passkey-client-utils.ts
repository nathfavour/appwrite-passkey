'use client';

import { base64UrlToBuffer, publicKeyCredentialToJSON } from '@/lib/webauthn-utils';
import { account } from '@/lib/appwrite';

export async function addPasskeyToAccount(email: string) {
  if (!('credentials' in navigator)) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  const res = await fetch('/api/webauthn/connect/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to get registration options');
  }

  const options = await res.json();

  const publicKey: Record<string, unknown> = { ...options };
  publicKey.challenge = base64UrlToBuffer(options.challenge as string);
  if (publicKey.user?.id) publicKey.user.id = base64UrlToBuffer(options.user.id as string);
  if (publicKey.excludeCredentials) {
    publicKey.excludeCredentials = publicKey.excludeCredentials.map((c: Record<string, unknown>) => ({
      ...c,
      id: base64UrlToBuffer(c.id as string),
    }));
  }

  const cred = await navigator.credentials.create({ publicKey });
  if (!cred) throw new Error('Credential creation returned null');

  const json = publicKeyCredentialToJSON(cred);

  const verifyRes = await fetch('/api/webauthn/connect/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      email: email, 
      attestation: json, 
      challenge: options.challenge, 
      challengeToken: options.challengeToken 
    }),
  });

  if (!verifyRes.ok) {
    const data = await verifyRes.json();
    throw new Error(data.error || 'Failed to verify passkey');
  }

  return verifyRes.json();
}

export async function listPasskeys(email: string) {
  const res = await fetch(`/api/webauthn/passkeys/list?email=${encodeURIComponent(email)}`);
  
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to list passkeys');
  }

  const data = await res.json();
  return data.passkeys || [];
}

export async function deletePasskey(email: string, credentialId: string) {
  const res = await fetch('/api/webauthn/passkeys/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, credentialId }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to delete passkey');
  }

  return res.json();
}

export async function renamePasskey(email: string, credentialId: string, name: string) {
  const res = await fetch('/api/webauthn/passkeys/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, credentialId, name }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to rename passkey');
  }

  return res.json();
}

export async function disablePasskey(email: string, credentialId: string) {
  const res = await fetch('/api/webauthn/passkeys/disable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, credentialId }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to disable passkey');
  }

  return res.json();
}

export async function enablePasskey(email: string, credentialId: string) {
  const res = await fetch('/api/webauthn/passkeys/enable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, credentialId }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to enable passkey');
  }

  return res.json();
}

export async function signOut() {
  try {
    await account.deleteSession('current');
  } catch (err) {
    console.error('Sign out error:', err);
  }
}
