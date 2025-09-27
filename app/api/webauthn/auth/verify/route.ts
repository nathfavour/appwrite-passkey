import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { getChallenge, getChallengeRecord, clearChallenge, getCredentialById, updateCounter } from '../../../../../lib/webauthnRepo';
import { rateLimit, buildRateKey } from '../../../../../lib/rateLimit';
import { ensureAppwriteUserAndToken } from '../../../../../lib/appwriteUser';

// Verifies WebAuthn authentication assertion and updates signature counter.
// On success, provides an Appwrite custom token for session creation.
export async function POST(req: Request) {
  try {
    const { userId: rawUserId, assertion } = await req.json();
    const userId = String(rawUserId).trim();
    if (!userId || !assertion) return NextResponse.json({ error: 'userId and assertion required' }, { status: 400 });

    // Rate limit auth verification per IP + credential
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const windowMs = parseInt(process.env.WEBAUTHN_RATE_LIMIT_WINDOW_MS || '60000', 10);
    const max = parseInt(process.env.WEBAUTHN_RATE_LIMIT_MAX || '30', 10); // allow more verify attempts
    const rl = rateLimit(buildRateKey(['webauthn','auth','verify', ip, userId]), max, windowMs);
    if (!rl.allowed) return NextResponse.json({ error: 'Too many authentication attempts. Please wait.' }, { status: 429, headers: { 'Retry-After': Math.ceil((rl.reset - Date.now())/1000).toString() } });

    const expectedChallenge = await getChallenge(userId);
    if (!expectedChallenge) return NextResponse.json({ error: 'No challenge for user' }, { status: 400 });

    // TTL enforcement
    const ttlMs = parseInt(process.env.WEBAUTHN_CHALLENGE_TTL_MS || '120000', 10);
    const record = await getChallengeRecord(userId);
    if (record && record.createdAt && Date.now() - record.createdAt > ttlMs) {
      await clearChallenge(userId);
      return NextResponse.json({ error: 'Challenge expired' }, { status: 400 });
    }

    const credId = assertion.rawId || assertion.id;
    const credential = await getCredentialById(credId);
    if (!credential) return NextResponse.json({ error: 'Unknown credential' }, { status: 400 });

    const rpID = process.env.NEXT_PUBLIC_RP_ID || 'localhost';
    const origin = process.env.NEXT_PUBLIC_ORIGIN || `http://${rpID}:3000`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const verification = await (verifyAuthenticationResponse as any)({
      credential: assertion,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        counter: credential.counter,
        credentialPublicKey: Buffer.from(credential.publicKey, 'base64url'),
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: 'Authentication verification failed' }, { status: 400 });
    }

    await updateCounter(credential.id, verification.authenticationInfo!.newCounter || credential.counter);
    await clearChallenge(userId);

    const token = await ensureAppwriteUserAndToken(userId);
    if (token?.secret) return NextResponse.json({ success: true, token: { ...token, userId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || String(err) }, { status: 500 });
  }
}
