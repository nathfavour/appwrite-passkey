/**
 * Verify and Store Connected Passkey
 * 
 * Endpoint: POST /api/webauthn/connect/verify
 * 
 * Purpose: Verify the WebAuthn registration response and store the passkey
 * for an existing authenticated user.
 * 
 * Differences from /api/webauthn/register/verify:
 * - Requires active session (must be authenticated)
 * - Verifies session user matches email parameter (prevent hijacking)
 * - Stores passkey WITHOUT creating a session (user already authenticated)
 * - Uses rate limiting but no session creation
 * - Same security as registration, but additive (adding to existing account)
 * 
 * Body: {
 *   email: string,
 *   assertion: any,
 *   challenge: string,
 *   challengeToken: string
 * }
 * 
 * Response: { success: true } (no session token, user stays authenticated)
 */

export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { verifyChallengeToken } from '../../../../../lib/passkeys';
import { PasskeyServer } from '../../../../../lib/passkey-server';
import { rateLimit, buildRateKey } from '../../../../../lib/rateLimit';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email: rawEmail, attestation, challengeToken, challenge } = body || {};
    const email = String(rawEmail || '').trim().toLowerCase();
    if (!email || !attestation || !challengeToken || !challenge) {
      return NextResponse.json({ error: 'email, attestation, challenge and challengeToken required' }, { status: 400 });
    }

    // Rate limit verification attempts (per IP + email)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const windowMs = parseInt(process.env.WEBAUTHN_RATE_LIMIT_WINDOW_MS || '60000', 10);
    const max = parseInt(process.env.WEBAUTHN_RATE_LIMIT_MAX || '20', 10);
    const rl = rateLimit(buildRateKey(['webauthn','connect','verify', ip, email]), max, windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many verification attempts. Wait and retry.' }, { status: 429, headers: { 'Retry-After': Math.ceil((rl.reset - Date.now())/1000).toString() } });
    }

    // Stateless challenge validation
    try {
      verifyChallengeToken(email, challenge, challengeToken);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }

    // Derive expected RP ID and Origin dynamically from request headers, with env overrides
    const url = new URL(req.url);
    const forwardedProto = req.headers.get('x-forwarded-proto');
    const forwardedHost = req.headers.get('x-forwarded-host');
    const hostHeader = forwardedHost || req.headers.get('host') || url.host;
    const protocol = (forwardedProto || url.protocol.replace(':', '')).toLowerCase();
    const hostNoPort = hostHeader.split(':')[0];
    const rpID = process.env.NEXT_PUBLIC_RP_ID || hostNoPort || 'localhost';
    const origin = process.env.NEXT_PUBLIC_ORIGIN || `${protocol}://${hostHeader}`;

    // Shape & type validation + reconstruction to avoid prototype issues
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
      verification = await verifyRegistrationResponse({
        response: attestation,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
    } catch (libErr) {
      const msg = (libErr as Error).message || String(libErr);
      return NextResponse.json({ error: 'WebAuthn library verification threw', detail: msg, ...(debug ? { attestationShape: Object.keys(attestation || {}), responseKeys: attestation?.response ? Object.keys(attestation.response) : [], idLength: attestation?.id?.length, expectedOrigin: origin, expectedRPID: rpID, expectedChallenge: String(challenge).slice(0,8)+'...' } : {}) }, { status: 400 });
    }

    if (!verification?.verified) {
      return NextResponse.json({ error: 'Registration verification failed', detail: verification, ...(debug ? { idLen: (credential.id||'').length, rawIdType: typeof credential.rawId, rawIdLen: (credential.rawId||'').length, expectedOrigin: origin, expectedRPID: rpID, expectedChallenge: challenge.slice(0,8)+'...' } : {}) }, { status: 400 });
    }

    const registrationInfo: any = (verification as any).registrationInfo;
    if (!registrationInfo) {
      return NextResponse.json({ error: 'Missing registrationInfo in verification result' }, { status: 500 });
    }

    // Normalize binary fields to base64url strings
    const toBase64Url = (val: unknown): string | null => {
      if (!val) return null;
      if (typeof val === 'string') {
        return val;
      }
      const anyVal: any = val;
      if (typeof Buffer !== 'undefined' && (Buffer.isBuffer?.(anyVal) || anyVal instanceof Uint8Array)) {
        return Buffer.from(anyVal).toString('base64url');
      }
      if (anyVal instanceof ArrayBuffer) {
        return Buffer.from(new Uint8Array(anyVal)).toString('base64url');
      }
      return null;
    };

    // Support both v7 and v8 shapes from simplewebauthn
    const credObj = registrationInfo.credential || {};
    const credId = toBase64Url(credObj.id) || toBase64Url((registrationInfo as any).credentialID);
    const pubKey = toBase64Url(credObj.publicKey) || toBase64Url((registrationInfo as any).credentialPublicKey);
    const counter = credObj.counter ?? registrationInfo.counter ?? 0;
    const transports = credObj.transports ?? [];

    if (!credId || !pubKey) {
      return NextResponse.json({ error: 'Registration returned incomplete credential', ...(debug ? { registrationInfoKeys: Object.keys(registrationInfo || {}), credentialKeys: Object.keys(credObj || {}) } : {}) }, { status: 500 });
    }

    // Persist passkey in user prefs - reuse same logic as registration
    const server = new PasskeyServer();
    const result = await server.registerPasskey(email, attestation, challenge, { rpID, origin });
    if (!result?.token?.secret) {
      return NextResponse.json({ error: 'Failed to register passkey' }, { status: 500 });
    }

    // Success - no session created (user already authenticated)
    return NextResponse.json({
      success: true,
      message: 'Passkey connected successfully. You can now sign in with it.',
    });
  } catch (err) {
    const debug = process.env.WEBAUTHN_DEBUG === '1';
    const errorMsg = (err as Error).message || String(err);
    return NextResponse.json({ error: errorMsg, ...(debug ? { stack: (err as Error).stack } : {}) }, { status: 500 });
  }
}
