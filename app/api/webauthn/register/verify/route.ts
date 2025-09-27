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
    const { userId: rawUserId, attestation, challengeToken, challenge } = body || {};
    const userId = String(rawUserId || '').trim().toLowerCase();
    if (!userId || !attestation || !challengeToken || !challenge) {
      return NextResponse.json({ error: 'userId, attestation, challenge and challengeToken required' }, { status: 400 });
    }

    // Rate limit verification attempts (per IP + user)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const windowMs = parseInt(process.env.WEBAUTHN_RATE_LIMIT_WINDOW_MS || '60000', 10);
    const max = parseInt(process.env.WEBAUTHN_RATE_LIMIT_MAX || '20', 10); // allow more for verify but still bounded
    const rl = rateLimit(buildRateKey(['webauthn','register','verify', ip, userId]), max, windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many verification attempts. Wait and retry.' }, { status: 429, headers: { 'Retry-After': Math.ceil((rl.reset - Date.now())/1000).toString() } });
    }

    // Stateless challenge validation
    try {
      verifyChallengeToken(userId, challenge, challengeToken);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }

    const rpID = process.env.NEXT_PUBLIC_RP_ID || 'localhost';
    const origin = process.env.NEXT_PUBLIC_ORIGIN || `http://${rpID}:3000`;

    // Shape & type validation + reconstruction to avoid prototype issues
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const att: any = attestation;
    const shapeErrors: string[] = [];
    if (typeof att !== 'object' || !att) shapeErrors.push('attestation not object');
    if (!att.id) shapeErrors.push('missing id');
    if (!att.rawId) shapeErrors.push('missing rawId');
    if (att.type !== 'public-key') shapeErrors.push('type not public-key');
    if (!att.response) shapeErrors.push('missing response');
    if (att.response && !att.response.clientDataJSON) shapeErrors.push('missing response.clientDataJSON');
    if (att.response && !att.response.attestationObject) shapeErrors.push('missing response.attestationObject');
    if (shapeErrors.length) {
      return NextResponse.json({ error: 'Malformed attestation', detail: shapeErrors }, { status: 400 });
    }

    // Reconstruct minimal credential object expected by simplewebauthn
    const credential = {
      id: att.id,
      rawId: att.rawId,
      type: att.type,
      response: {
        clientDataJSON: att.response.clientDataJSON,
        attestationObject: att.response.attestationObject,
      },
      clientExtensionResults: att.clientExtensionResults || {},
    };

    const debug = process.env.WEBAUTHN_DEBUG === '1';

    let verification: any;
    try {
      verification = await (verifyRegistrationResponse as any)({
        credential,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
    } catch (libErr) {
      return NextResponse.json({ error: 'WebAuthn library verification threw', detail: (libErr as Error).message, ...(debug ? { credentialShape: Object.keys(credential), responseKeys: Object.keys(credential.response || {}), idLength: credential.id?.length } : {}) }, { status: 400 });
    }

    if (!verification?.verified) {
      return NextResponse.json({ error: 'Registration verification failed', detail: verification }, { status: 400 });
    }

    const registrationInfo = verification.registrationInfo;
    if (!registrationInfo) {
      return NextResponse.json({ error: 'Missing registrationInfo in verification result' }, { status: 500 });
    }

    const credId = registrationInfo.credentialID.toString('base64url');
    const pubKey = registrationInfo.credentialPublicKey.toString('base64url');
    const counter = registrationInfo.counter || 0;

    // Attempt storing passkey; if Appwrite not configured, continue gracefully
    try {
      await addPasskey(userId, { id: credId, publicKey: pubKey, counter });
    } catch (storeErr) {
      // Provide explicit message to help configure backend
      console.warn('Passkey store failed (continuing):', (storeErr as Error).message);
    }

    const token = await createCustomToken(userId).catch(() => null);
    if (token?.secret) {
      return NextResponse.json({ success: true, token: { ...token, userId } });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const debug = process.env.WEBAUTHN_DEBUG === '1';
    return NextResponse.json({ error: (err as Error).message || String(err), ...(debug ? { stack: (err as Error).stack } : {}) }, { status: 500 });
  }
}
