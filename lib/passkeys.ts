import crypto from 'crypto';

// Stateless WebAuthn passkey support:
// - issueChallenge(): creates random challenge + HMAC-signed token (no server storage)
// - verifyChallengeToken(): validates challenge, user binding, expiry
// - Credentials stored in Appwrite user preferences (passkeys array)
// - addPasskey/updatePasskeyCounter operate purely via Users API
// - createCustomToken() mints short-lived secret for session exchange
// Environment vars required: NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT, APPWRITE_API, PASSKEY_CHALLENGE_SECRET
// Security notes:
//   * PASSKEY_CHALLENGE_SECRET must be strong & rotated if leaked
//   * Lowercasing of userId occurs in routes to ensure deterministic keys
//   * Counters help detect cloned authenticators; currently just overwrite stored counter

const endpoint = (process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '').replace(/\/$/, '');
const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT;
const apiKey = process.env.APPWRITE_API;
const secret = process.env.PASSKEY_CHALLENGE_SECRET || 'dev-insecure-secret';

function baseHeaders() {
  return {
    'X-Appwrite-Project': project!,
    'X-Appwrite-Key': apiKey!,
    'Content-Type': 'application/json',
  };
}

function randomChallenge(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

// Payload we sign: { userId, challenge, exp }
export function issueChallenge(userId: string, ttlMs: number) {
  const challenge = randomChallenge();
  const exp = Date.now() + ttlMs;
  const payload = JSON.stringify({ u: userId, c: challenge, e: exp });
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const token = Buffer.from(payload).toString('base64url') + '.' + sig;
  return { challenge, challengeToken: token };
}

export function verifyChallengeToken(userId: string, challenge: string, token: string) {
  const parts = token.split('.');
  if (parts.length !== 2) throw new Error('Malformed challenge token');
  const payloadJson = Buffer.from(parts[0], 'base64url').toString();
  const sig = parts[1];
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadJson).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) throw new Error('Invalid challenge signature');
  let parsed: { u: string; c: string; e: number };
  try { parsed = JSON.parse(payloadJson); } catch { throw new Error('Bad challenge payload'); }
  if (parsed.u !== userId) throw new Error('User mismatch');
  if (parsed.c !== challenge) throw new Error('Challenge mismatch');
  if (Date.now() > parsed.e) throw new Error('Challenge expired');
  return true;
}

// ---- Credential storage in Appwrite Users preferences ----
// Structure: preferences.passkeys = [{ id, publicKey, counter }]

async function fetchUser(userId: string) {
  if (!endpoint || !project || !apiKey) throw new Error('Appwrite not configured');
  const res = await fetch(`${endpoint}/v1/users/${encodeURIComponent(userId)}`, { headers: baseHeaders() });
  if (res.ok) return res.json();
  if (res.status === 404) return null;
  throw new Error(`Fetch user failed ${res.status}`);
}

async function createUserIfMissing(userId: string) {
  const existing = await fetchUser(userId);
  if (existing) return existing;
  const randomPw = crypto.randomBytes(24).toString('hex');
  const res = await fetch(`${endpoint}/v1/users`, { method: 'POST', headers: baseHeaders(), body: JSON.stringify({ userId, email: userId, password: randomPw, name: userId }) });
  if (!res.ok) throw new Error('User create failed');
  return res.json();
}

export type StoredPasskey = { id: string; publicKey: string; counter: number };

export async function getPasskeys(userId: string): Promise<StoredPasskey[]> {
  const user = await fetchUser(userId);
  if (!user) return [];
  const prefs = user.prefs || user.preferences || {};
  const raw = (prefs as any).passkeys;
  if (Array.isArray(raw)) return raw as StoredPasskey[];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as StoredPasskey[]; } catch { return []; }
  }
  return [];
}

async function writePasskeys(userId: string, passkeys: StoredPasskey[]) {
  const res = await fetch(`${endpoint}/v1/users/${encodeURIComponent(userId)}/prefs`, { method: 'PATCH', headers: baseHeaders(), body: JSON.stringify({ passkeys }) });
  if (!res.ok) throw new Error(`Write prefs failed ${res.status}`);
  return res.json();
}

export async function addPasskey(userId: string, pk: StoredPasskey) {
  await createUserIfMissing(userId);
  const existing = await getPasskeys(userId);
  if (!existing.find(e => e.id === pk.id)) existing.push(pk);
  await writePasskeys(userId, existing);
}

export async function updatePasskeyCounter(userId: string, id: string, counter: number) {
  const existing = await getPasskeys(userId);
  const target = existing.find(e => e.id === id);
  if (target) target.counter = counter;
  await writePasskeys(userId, existing);
}

export async function createCustomToken(userId: string) {
  if (!endpoint || !project || !apiKey) return null;
  // ensure user
  await createUserIfMissing(userId).catch(()=>{});
  const tokenRes = await fetch(`${endpoint}/v1/users/${encodeURIComponent(userId)}/tokens`, { method: 'POST', headers: baseHeaders() });
  if (!tokenRes.ok) return null;
  return tokenRes.json();
}
