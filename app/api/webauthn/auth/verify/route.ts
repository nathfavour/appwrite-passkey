import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { verifyChallengeToken, getPasskeys, updatePasskeyCounter, createCustomToken } from '../../../../../lib/passkeys';
import { rateLimit, buildRateKey } from '../../../../../lib/rateLimit';

// Verifies WebAuthn authentication assertion and updates signature counter.
// On success, provides an Appwrite custom token for session creation.
export async function POST(req: Request) {
  try {
    const { userId: rawUserId, assertion, challengeToken, challenge } = await req.json();
    const userId = String(rawUserId).trim().toLowerCase();
    if (!userId || !assertion || !challengeToken || !challenge) return NextResponse.json({ error: 'userId, assertion, challenge and challengeToken required' }, { status: 400 });

    // Rate limit auth verification per IP + credential
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const windowMs = parseInt(process.env.WEBAUTHN_RATE_LIMIT_WINDOW_MS || '60000', 10);
    const max = parseInt(process.env.WEBAUTHN_RATE_LIMIT_MAX || '30', 10); // allow more verify attempts
    const rl = rateLimit(buildRateKey(['webauthn','auth','verify', ip, userId]), max, windowMs);
    if (!rl.allowed) return NextResponse.json({ error: 'Too many authentication attempts. Please wait.' }, { status: 429, headers: { 'Retry-After': Math.ceil((rl.reset - Date.now())/1000).toString() } });

    // Stateless challenge validation
    try {
      verifyChallengeToken(userId, challenge, challengeToken);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }

    // Find credential in preferences
    const credId = assertion.rawId || assertion.id;
    const passkeys = await getPasskeys(userId);
    const credential = passkeys.find(p => p.id === credId);
    if (!credential) return NextResponse.json({ error: 'Unknown credential' }, { status: 400 });

    // Derive expected RP ID and Origin dynamically from request headers, with env overrides
    const url = new URL(req.url);
    const forwardedProto = req.headers.get('x-forwarded-proto');
    const forwardedHost = req.headers.get('x-forwarded-host');
    const hostHeader = forwardedHost || req.headers.get('host') || url.host;
    const protocol = (forwardedProto || url.protocol.replace(':', '')).toLowerCase();
    const hostNoPort = hostHeader.split(':')[0];
    const rpID = process.env.NEXT_PUBLIC_RP_ID || hostNoPort || 'localhost';
    const origin = process.env.NEXT_PUBLIC_ORIGIN || `${protocol}://${hostHeader}`;

    // Basic shape validation before library call
    if (typeof assertion !== 'object' || !assertion) {
      return NextResponse.json({ error: 'Malformed assertion: not an object' }, { status: 400 });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(assertion as any).response || !(assertion as any).response.clientDataJSON) {
      return NextResponse.json({ error: 'Malformed assertion: missing response.clientDataJSON' }, { status: 400 });
    }
    const debug = process.env.WEBAUTHN_DEBUG === '1';
    // Pass assertion fields as received (base64url strings); simplewebauthn decodes internally.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let verification: any;
    try {
      verification = await verifyAuthenticationResponse({
        response: assertion,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        authenticator: {
          counter: credential.counter,
          credentialPublicKey: Buffer.from(credential.publicKey, 'base64url'),
        },
      });
    } catch (libErr) {
      return NextResponse.json({ error: 'WebAuthn library authentication threw', detail: (libErr as Error).message, ...(debug ? { assertionShape: Object.keys(assertion || {}), responseKeys: assertion?.response ? Object.keys(assertion.response) : [] } : {}) }, { status: 400 });
    }

    if (!verification.verified) {
      return NextResponse.json({ error: 'Authentication verification failed', ...(debug ? { verification } : {}) }, { status: 400 });
    }

    await updatePasskeyCounter(userId, credential.id, verification.authenticationInfo!.newCounter || credential.counter);

    const token = await createCustomToken(userId);
    if (token?.secret) return NextResponse.json({ success: true, token: { ...token, userId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    const debug = process.env.WEBAUTHN_DEBUG === '1';
    return NextResponse.json({ error: (err as Error).message || String(err), ...(debug ? { stack: (err as Error).stack } : {}) }, { status: 500 });
  }
}
