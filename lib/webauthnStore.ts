// Lightweight in-memory store for PoC only.
// Replace with a persistent DB in production.

type Credential = {
  id: string; // base64url
  publicKey: string; // base64url
  counter: number;
  userId: string;
};

type ChallengeRecord = { challenge: string; createdAt: number };
const challenges = new Map<string, ChallengeRecord>(); // userId -> challenge + timestamp
const credentialsById = new Map<string, Credential>();
const credentialsByUser = new Map<string, Credential[]>();

export function saveChallenge(userId: string, challenge: string) {
  challenges.set(userId, { challenge, createdAt: Date.now() });
}

export function getChallenge(userId: string) {
  const rec = challenges.get(userId);
  return rec ? rec.challenge : null;
}

export function getChallengeRecord(userId: string) {
  return challenges.get(userId) || null;
}

export function clearChallenge(userId: string) {
  challenges.delete(userId);
}

export function saveCredential(cred: Credential) {
  credentialsById.set(cred.id, cred);
  const arr = credentialsByUser.get(cred.userId) || [];
  arr.push(cred);
  credentialsByUser.set(cred.userId, arr);
}

export function getCredentialById(id: string) {
  return credentialsById.get(id) || null;
}

export function getCredentialsByUser(userId: string) {
  return credentialsByUser.get(userId) || [];
}

export function updateCounter(id: string, counter: number) {
  const c = credentialsById.get(id);
  if (c) {
    c.counter = counter;
  }
}

export function clearAll() {
  challenges.clear();
  credentialsById.clear();
  credentialsByUser.clear();
}
