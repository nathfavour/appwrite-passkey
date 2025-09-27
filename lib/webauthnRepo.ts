// Persistent + fallback WebAuthn storage using Appwrite Database via REST fetch.
// Only used server-side in Route Handlers. Falls back to in-memory store if
// required env vars are missing. Passkey augments (not replaces) Appwrite auth.

import { headers } from 'next/headers'; // (kept in case of future contextual needs)
import {
  saveChallenge as memSaveChallenge,
  getChallenge as memGetChallenge,
  clearChallenge as memClearChallenge,
  saveCredential as memSaveCredential,
  getCredentialById as memGetCredentialById,
  getCredentialsByUser as memGetCredentialsByUser,
  updateCounter as memUpdateCounter,
} from './webauthnStore';

const endpoint = (process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '').replace(/\/$/, '');
const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT;
const apiKey = process.env.APPWRITE_API;
const databaseId = process.env.APPWRITE_DB_ID;
const credsCollection = process.env.APPWRITE_CREDENTIALS_COLLECTION_ID;
const challCollection = process.env.APPWRITE_CHALLENGES_COLLECTION_ID;

function enabled() {
  return !!(endpoint && project && apiKey && databaseId && credsCollection && challCollection);
}

function baseHeaders() {
  return {
    'X-Appwrite-Project': project!,
    'X-Appwrite-Key': apiKey!,
    'Content-Type': 'application/json',
  };
}

async function appwriteFetch(path: string, init: RequestInit) {
  if (!enabled()) throw new Error('Persistence not enabled');
  const res = await fetch(`${endpoint}${path}`, init);
  if (!res.ok) throw new Error(`Appwrite API error ${res.status}`);
  return res.json();
}

// -------- Challenge Operations --------
export async function saveChallenge(userId: string, challenge: string) {
  if (!enabled()) return memSaveChallenge(userId, challenge);
  const payload = { documentId: userId, data: { userId, challenge, createdAt: Date.now() } };
  try {
    await appwriteFetch(`/v1/databases/${databaseId}/collections/${challCollection}/documents`, {
      method: 'POST', headers: baseHeaders(), body: JSON.stringify(payload),
    });
  } catch (e) {
    // Try update (document exists)
    try {
      await appwriteFetch(`/v1/databases/${databaseId}/collections/${challCollection}/documents/${userId}`, {
        method: 'PATCH', headers: baseHeaders(), body: JSON.stringify({ data: { challenge, createdAt: Date.now() } }),
      });
    } catch {
      // Fallback memory
      memSaveChallenge(userId, challenge);
    }
  }
}

export async function getChallenge(userId: string) {
  if (!enabled()) return memGetChallenge(userId);
  try {
    const doc: any = await appwriteFetch(`/v1/databases/${databaseId}/collections/${challCollection}/documents/${userId}`, { method: 'GET', headers: baseHeaders() });
    return doc?.data?.challenge || null;
  } catch {
    return null;
  }
}

export async function getChallengeRecord(userId: string) {
  if (!enabled()) {
    // @ts-ignore accessing internal for timestamp retrieval; memory store variant
    const { getChallengeRecord: memGetChallengeRecord } = await import('./webauthnStore');
    return memGetChallengeRecord(userId);
  }
  try {
    const doc: any = await appwriteFetch(`/v1/databases/${databaseId}/collections/${challCollection}/documents/${userId}`, { method: 'GET', headers: baseHeaders() });
    if (!doc?.data) return null;
    return { challenge: doc.data.challenge, createdAt: doc.data.createdAt };
  } catch {
    return null;
  }
}

export async function clearChallenge(userId: string) {
  if (!enabled()) return memClearChallenge(userId);
  try {
    await fetch(`${endpoint}/v1/databases/${databaseId}/collections/${challCollection}/documents/${userId}`, { method: 'DELETE', headers: baseHeaders() });
  } catch {
    // ignore
  }
}

// -------- Credential Operations --------
export type StoredCredential = { id: string; publicKey: string; counter: number; userId: string };

export async function saveCredential(cred: StoredCredential) {
  if (!enabled()) return memSaveCredential(cred);
  const payload = { documentId: cred.id, data: { ...cred, createdAt: Date.now(), updatedAt: Date.now() } };
  try {
    await appwriteFetch(`/v1/databases/${databaseId}/collections/${credsCollection}/documents`, {
      method: 'POST', headers: baseHeaders(), body: JSON.stringify(payload),
    });
  } catch {
    try {
      await appwriteFetch(`/v1/databases/${databaseId}/collections/${credsCollection}/documents/${cred.id}`, {
        method: 'PATCH', headers: baseHeaders(), body: JSON.stringify({ data: { ...cred, updatedAt: Date.now() } }),
      });
    } catch {
      memSaveCredential(cred);
    }
  }
}

export async function getCredentialById(id: string) {
  if (!enabled()) return memGetCredentialById(id);
  try {
    const doc: any = await appwriteFetch(`/v1/databases/${databaseId}/collections/${credsCollection}/documents/${id}`, { method: 'GET', headers: baseHeaders() });
    return doc?.data ? { id: doc.$id, publicKey: doc.data.publicKey, counter: doc.data.counter, userId: doc.data.userId } : null;
  } catch {
    return null;
  }
}

export async function getCredentialsByUser(userId: string) {
  if (!enabled()) return memGetCredentialsByUser(userId);
  try {
    const query = encodeURIComponent(`equal(\"userId\", \"${userId}\")`);
    const list: any = await appwriteFetch(`/v1/databases/${databaseId}/collections/${credsCollection}/documents?queries[]=${query}`, { method: 'GET', headers: baseHeaders() });
    return (list.documents || []).map((d: any) => ({ id: d.$id, publicKey: d.data.publicKey, counter: d.data.counter, userId: d.data.userId }));
  } catch {
    return [];
  }
}

export async function updateCounter(id: string, counter: number) {
  if (!enabled()) return memUpdateCounter(id, counter);
  try {
    await appwriteFetch(`/v1/databases/${databaseId}/collections/${credsCollection}/documents/${id}`, {
      method: 'PATCH', headers: baseHeaders(), body: JSON.stringify({ data: { counter, updatedAt: Date.now() } }),
    });
  } catch {
    // ignore
  }
}

export function persistenceEnabled() { return enabled(); }
