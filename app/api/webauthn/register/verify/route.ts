import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { verifyChallengeToken, addPasskey, createCustomToken } from '../../../../../lib/passkeys';
import { rateLimit, buildRateKey } from '../../../../../lib/rateLimit';

// Verifies WebAuthn registration response then stores credential.
// After successful passkey registration, obtains an Appwrite custom token
// so client can exchange it for a session (passkey augments Appwrite auth).
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId: rawUserId, attestation, challengeToken, challenge } = body;
    const userId = String(rawUserId).trim();
    if (!userId || !attestation || !challengeToken || !challenge) return NextResponse.json({ error: 'userId, attestation, challenge and challengeToken required' }, { status: 400 });

    // Rate limit verification attempts (per IP + user)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const windowMs = parseInt(process.env.WEBAUTHN_RATE_LIMIT_WINDOW_MS || '60000', 10);
    const max = parseInt(process.env.WEBAUTHN_RATE_LIMIT_MAX || '20', 10); // allow more for verify but still bounded
    const rl = rateLimit(buildRateKey(['webauthn','register','verify', ip, userId]), max, windowMs);
    if (!rl.allowed) return NextResponse.json({ error: 'Too many verification attempts. Wait and retry.' }, { status: 429, headers: { 'Retry-After': Math.ceil((rl.reset - Date.now())/1000).toString() } });

    // Stateless challenge validation
    try {
      verifyChallengeToken(userId, challenge, challengeToken);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }

    const rpID = process.env.NEXT_PUBLIC_RP_ID || 'localhost';
    const origin = process.env.NEXT_PUBLIC_ORIGIN || `http://${rpID}:3000`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const verification = await (verifyRegistrationResponse as any)({
      credential: attestation,
      expectedChallenge: challenge,
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

    await addPasskey(userId, { id: credId, publicKey: pubKey, counter });

    const token = await createCustomToken(userId);
    if (token?.secret) return NextResponse.json({ success: true, token: { ...token, userId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || String(err) }, { status: 500 });
  }
}
