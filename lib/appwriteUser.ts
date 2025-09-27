// Shared helper to ensure an Appwrite user exists and to mint a custom token
// for session exchange after WebAuthn verification.
export async function ensureAppwriteUserAndToken(userId: string) {
  const endpoint = (process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '').replace(/\/$/, '');
  const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT;
  const key = process.env.APPWRITE_API;
  if (!endpoint || !project || !key) return null;

  const headers = { 'X-Appwrite-Project': project, 'X-Appwrite-Key': key, 'Content-Type': 'application/json' };

  // Check if user exists
  const userUrl = `${endpoint}/v1/users/${encodeURIComponent(userId)}`;
  let exists = false;
  try {
    const res = await fetch(userUrl, { method: 'GET', headers });
    exists = res.ok;
  } catch {
    exists = false;
  }

  if (!exists) {
    const createUrl = `${endpoint}/v1/users`;
    const randomPw = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    try {
      await fetch(createUrl, { method: 'POST', headers, body: JSON.stringify({ userId, email: userId, password: randomPw, name: userId }) });
    } catch {
      // ignore user creation failure; token request will fail if user missing
    }
  }

  // Create a custom token (short-lived secret) for client to exchange
  const tokenUrl = `${endpoint}/v1/users/${encodeURIComponent(userId)}/tokens`;
  try {
    const tokenRes = await fetch(tokenUrl, { method: 'POST', headers });
    if (!tokenRes.ok) return null;
    const tokenJson = await tokenRes.json();
    return tokenJson; // contains $id and secret
  } catch {
    return null;
  }
}
