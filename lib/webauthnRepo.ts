// Persistent + fallback WebAuthn storage using Appwrite Database via REST fetch.
// Only used server-side in Route Handlers. Falls back to in-memory store if
// required env vars are missing. Passkey augments (not replaces) Appwrite auth.

import {
  saveChallenge as memSaveChallenge,
  getChallenge as memGetChallenge,
  clearChallenge as memClearChallenge,
  saveCredential as memSaveCredential,
  getCredentialById as memGetCredentialById,
  getCredentialsByUser as memGetCredentialsByUser,
  updateCounter as memUpdateCounter,
} from './webauthnStore';
import type { Credentials } from '@/types/appwrite';

const endpoint = (process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '').replace(/\/$/, '');
const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT;
const apiKey = process.env.APPWRITE_API;
const databaseId = process.env.APPWRITE_DB_ID;
const credsCollection = process.env.APPWRITE_CREDENTIALS_COLLECTION_ID;
const challCollection = process.env.APPWRITE_CHALLENGES_COLLECTION_ID;

function challengeDocId(userId: string) {
  const base = String(userId).trim();
  try {
    return Buffer.from(base).toString('base64url').slice(0, 36) || base.slice(0, 36);
  } catch {
    return base.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 36);
  }
}

const debug = process.env.DEBUG_WEBAUTHN === '1' || process.env.DEBUG_WEBAUTHN === 'true';
function log(...args: unknown[]) { if (debug) console.log('[webauthnRepo]', ...args); }

function enabled() {
  const ok = !!(endpoint && project && apiKey && databaseId && credsCollection && challCollection);
  if (debug) log('persistence enabled?', ok, { endpoint: !!endpoint, project: !!project, apiKey: !!apiKey, databaseId: !!databaseId });
  return ok;
}

function baseHeaders() {
  return {
    'X-Appwrite-Project': project!,
    'X-Appwrite-Key': apiKey!,
    'Content-Type': 'application/json',
  } as Record<string, string>;
}

async function appwriteFetch(path: string, init: RequestInit) {
  if (!enabled()) throw new Error('Persistence not enabled');
  const url = `${endpoint}${path}`;
  const res = await fetch(url, init);
  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch { /* ignore */ }
    log('fetch error', { url, status: res.status, body });
    throw new Error(`Appwrite API error ${res.status} ${body}`.trim());
  }
  const json = await res.json();
  log('fetch ok', { url, method: (init.method || 'GET'), status: res.status });
  return json;
}

// -------- Challenge Operations --------
export async function saveChallenge(userId: string, challenge: string) {
  if (!enabled()) { log('memory saveChallenge', userId); return memSaveChallenge(userId, challenge); }
  const docId = challengeDocId(userId);
  const payload = { documentId: docId, data: { userId, challenge, createdAt: new Date().toISOString() } };
  try {
    log('POST challenge', { docId });
    await appwriteFetch(`/v1/databases/${databaseId}/collections/${challCollection}/documents`, {
      method: 'POST', headers: baseHeaders(), body: JSON.stringify(payload),
    });
  } catch (e) {
    try {
      log('PATCH challenge (exists)', { docId });
      await appwriteFetch(`/v1/databases/${databaseId}/collections/${challCollection}/documents/${docId}`, {
        method: 'PATCH', headers: baseHeaders(), body: JSON.stringify({ data: { challenge, createdAt: new Date().toISOString() } }),
      });
    } catch (e2) {
      log('fallback memory saveChallenge after failure', { userId, err: (e2 as Error).message });
      memSaveChallenge(userId, challenge);
    }
  }
}

export async function getChallenge(userId: string) {
  if (!enabled()) { return memGetChallenge(userId); }
  const docId = challengeDocId(userId);
  try {
    log('GET challenge', { docId });
    const doc: any = await appwriteFetch(`/v1/databases/${databaseId}/collections/${challCollection}/documents/${docId}`, { method: 'GET', headers: baseHeaders() });
    return doc?.data?.challenge || null;
  } catch (e) {
    log('getChallenge miss', { userId, err: (e as Error).message });
    return null;
  }
}

export async function getChallengeRecord(userId: string) {
  if (!enabled()) {
    // @ts-ignore accessing internal for timestamp retrieval; memory store variant
    const { getChallengeRecord: memGetChallengeRecord } = await import('./webauthnStore');
    return memGetChallengeRecord(userId);
  }
  const docId = challengeDocId(userId);
  try {
    const doc: any = await appwriteFetch(`/v1/databases/${databaseId}/collections/${challCollection}/documents/${docId}`, { method: 'GET', headers: baseHeaders() });
    if (!doc?.data) return null;
    return { challenge: doc.data.challenge, createdAt: doc.data.createdAt };
  } catch (e) {
    log('getChallengeRecord miss', { userId, err: (e as Error).message });
    return null;
  }
}

export async function clearChallenge(userId: string) {
  if (!enabled()) { return memClearChallenge(userId); }
  const docId = challengeDocId(userId);
  try {
    log('DELETE challenge', { docId });
    await fetch(`${endpoint}/v1/databases/${databaseId}/collections/${challCollection}/documents/${docId}`, { method: 'DELETE', headers: baseHeaders() });
  } catch (e) {
    log('clearChallenge failed (ignored)', { userId, err: (e as Error).message });
  }
}

// -------- Credential Operations --------
export type StoredCredential = { id: string } & Pick<Credentials, 'publicKey' | 'counter' | 'userId'>;

export async function saveCredential(cred: StoredCredential) {
  if (!enabled()) { log('memory saveCredential', cred.id); return memSaveCredential(cred); }
  const now = new Date().toISOString();
  const payload = { documentId: cred.id, data: { ...cred, createdAt: now, updatedAt: now } };
  try {
    log('POST credential', { id: cred.id });
    await appwriteFetch(`/v1/databases/${databaseId}/collections/${credsCollection}/documents`, {
      method: 'POST', headers: baseHeaders(), body: JSON.stringify(payload),
    });
  } catch (e) {
    try {
      log('PATCH credential (exists)', { id: cred.id });
      await appwriteFetch(`/v1/databases/${databaseId}/collections/${credsCollection}/documents/${cred.id}`, {
        method: 'PATCH', headers: baseHeaders(), body: JSON.stringify({ data: { ...cred, updatedAt: now } }),
      });
    } catch (e2) {
      log('fallback memory saveCredential after failure', { id: cred.id, err: (e2 as Error).message });
      memSaveCredential(cred);
    }
  }
}

export async function getCredentialById(id: string) {
  if (!enabled()) return memGetCredentialById(id);
  try {
    const doc: any = await appwriteFetch(`/v1/databases/${databaseId}/collections/${credsCollection}/documents/${id}`, { method: 'GET', headers: baseHeaders() });
    return doc?.data ? { id: doc.$id, publicKey: doc.data.publicKey as Credentials['publicKey'], counter: doc.data.counter as Credentials['counter'], userId: doc.data.userId as Credentials['userId'] } : null;
  } catch (e) {
    log('getCredentialById miss', { id, err: (e as Error).message });
    return null;
  }
}

export async function getCredentialsByUser(userId: string) {
  if (!enabled()) return memGetCredentialsByUser(userId);
  try {
    const query = encodeURIComponent(`equal(\"userId\", \"${userId}\")`);
    const list: any = await appwriteFetch(`/v1/databases/${databaseId}/collections/${credsCollection}/documents?queries[]=${query}`, { method: 'GET', headers: baseHeaders() });
    return (list.documents || []).map((d: any) => ({ id: d.$id, publicKey: d.data.publicKey as Credentials['publicKey'], counter: d.data.counter as Credentials['counter'], userId: d.data.userId as Credentials['userId'] } as StoredCredential));
  } catch (e) {
    log('getCredentialsByUser error', { userId, err: (e as Error).message });
    return [];
  }
}

export async function updateCounter(id: string, counter: number) {
  if (!enabled()) return memUpdateCounter(id, counter);
  try {
    log('PATCH credential counter', { id, counter });
    await appwriteFetch(`/v1/databases/${databaseId}/collections/${credsCollection}/documents/${id}`, {
      method: 'PATCH', headers: baseHeaders(), body: JSON.stringify({ data: { counter, updatedAt: new Date().toISOString() } }),
    });
  } catch (e) {
    log('updateCounter failed (ignored)', { id, err: (e as Error).message });
  }
}

export function persistenceEnabled() { return enabled(); }
