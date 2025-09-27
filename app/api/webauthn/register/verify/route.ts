import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { getChallenge, getChallengeRecord, clearChallenge, saveCredential } from '../../../../../lib/webauthnRepo';
import { rateLimit, buildRateKey } from '../../../../../lib/rateLimit';
import { ensureAppwriteUserAndToken } from '../../../../../lib/appwriteUser';

// Verifies WebAuthn registration response then stores credential.
// After successful passkey registration, obtains an Appwrite custom token
// so client can exchange it for a session (passkey augments Appwrite auth).
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId: rawUserId, attestation } = body;
    const userId = String(rawUserId).trim();
    if (!userId || !attestation) return NextResponse.json({ error: 'userId and attestation required' }, { status: 400 });

    // Rate limit verification attempts (per IP + user)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const windowMs = parseInt(process.env.WEBAUTHN_RATE_LIMIT_WINDOW_MS || '60000', 10);
    const max = parseInt(process.env.WEBAUTHN_RATE_LIMIT_MAX || '20', 10); // allow more for verify but still bounded
    const rl = rateLimit(buildRateKey(['webauthn','register','verify', ip, userId]), max, windowMs);
    if (!rl.allowed) return NextResponse.json({ error: 'Too many verification attempts. Wait and retry.' }, { status: 429, headers: { 'Retry-After': Math.ceil((rl.reset - Date.now())/1000).toString() } });

    const expectedChallenge = await getChallenge(userId);
    if (!expectedChallenge) return NextResponse.json({ error: 'No challenge for user' }, { status: 400 });

    // TTL enforcement
    const ttlMs = parseInt(process.env.WEBAUTHN_CHALLENGE_TTL_MS || '120000', 10); // default 2 minutes
    const record = await getChallengeRecord(userId);
    const createdAtMs = record && record.createdAt ? (typeof record.createdAt === 'string' ? Date.parse(record.createdAt) : record.createdAt) : null;
    if (createdAtMs && Date.now() - createdAtMs > ttlMs) {
      await clearChallenge(userId);
      return NextResponse.json({ error: 'Challenge expired' }, { status: 400 });
    }

    const rpID = process.env.NEXT_PUBLIC_RP_ID || 'localhost';
    const origin = process.env.NEXT_PUBLIC_ORIGIN || `http://${rpID}:3000`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const verification = await (verifyRegistrationResponse as any)({
      credential: attestation,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified) {
      return NextResponse.json({ error: 'Registration verification failed' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registrationInfo = (verification as any).registrationInfo;
    const credId = registrationInfo.credentialID.toString('base64url');
    const pubKey = registrationInfo.credentialPublicKey.toString('base64url');
    const counter = registrationInfo.counter || 0;

    await saveCredential({ id: credId, publicKey: pubKey, counter, userId });
    await clearChallenge(userId);

    const token = await ensureAppwriteUserAndToken(userId);
    if (token?.secret) return NextResponse.json({ success: true, token: { ...token, userId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || String(err) }, { status: 500 });
  }
}
