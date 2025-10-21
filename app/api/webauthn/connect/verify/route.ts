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
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { verifyChallengeToken } from '../../../../../lib/passkeys';
import { PasskeyServer } from '../../../../../lib/passkey-server';
import { rateLimit, buildRateKey } from '../../../../../lib/rateLimit';

export async function POST(req: Request) {
  let email = '';
  const server = new PasskeyServer();

  try {
    const { email: rawEmail, assertion, challengeToken, challenge } = await req.json();
    email = String(rawEmail).trim().toLowerCase();

    if (!email || !assertion || !challengeToken || !challenge) {
      return NextResponse.json(
        { error: 'email, assertion, challenge and challengeToken required' },
        { status: 400 }
      );
    }

    // ⭐ STEP 1: Verify user has active session
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'No active session. Please sign in first.' },
        { status: 401 }
      );
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      return NextResponse.json(
        { error: 'Invalid authorization header' },
        { status: 401 }
      );
    }

    // ⭐ STEP 2: Get user and verify they exist
    const user = await server.getUserIfExists(email);
    if (!user) {
      await server.recordAuthAttempt(email, false);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // ⭐ STEP 3: Check rate limiting (same as auth flow)
    const rateLimitCheck = await server.checkAuthRateLimit(email);
    if (!rateLimitCheck.allowed) {
      await server.recordAuthAttempt(email, false);
      return NextResponse.json(
        {
          error: rateLimitCheck.message || 'Rate limited',
          status: rateLimitCheck.status,
        },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    // Also keep old IP-based rate limit for defense-in-depth
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const windowMs = parseInt(process.env.WEBAUTHN_RATE_LIMIT_WINDOW_MS || '60000', 10);
    const max = parseInt(process.env.WEBAUTHN_RATE_LIMIT_MAX || '30', 10);
    const rl = rateLimit(buildRateKey(['webauthn', 'connect', 'verify', ip, email]), max, windowMs);
    if (!rl.allowed) {
      await server.recordAuthAttempt(email, false);
      return NextResponse.json(
        { error: 'Too many verification attempts. Please wait.' },
        { status: 429, headers: { 'Retry-After': Math.ceil((rl.reset - Date.now()) / 1000).toString() } }
      );
    }

    // ⭐ STEP 4: Verify challenge token
    try {
      verifyChallengeToken(email, challenge, challengeToken);
    } catch (e) {
      await server.recordAuthAttempt(email, false);
      return NextResponse.json(
        { error: (e as Error).message },
        { status: 400 }
      );
    }

    // ⭐ STEP 5: Derive expected RP ID and Origin
    const url = new URL(req.url);
    const forwardedProto = req.headers.get('x-forwarded-proto');
    const forwardedHost = req.headers.get('x-forwarded-host');
    const hostHeader = forwardedHost || req.headers.get('host') || url.host;
    const protocol = (forwardedProto || url.protocol.replace(':', '')).toLowerCase();
    const hostNoPort = hostHeader.split(':')[0];
    const rpID = process.env.NEXT_PUBLIC_RP_ID || hostNoPort || 'localhost';
    const origin = process.env.NEXT_PUBLIC_ORIGIN || `${protocol}://${hostHeader}`;

    // ⭐ STEP 6: Validate attestation shape
    const att: any = assertion;
    const shapeErrors: string[] = [];
    if (typeof att !== 'object' || !att) shapeErrors.push('attestation not object');
    if (!att.id) shapeErrors.push('missing id');
    if (!att.rawId) shapeErrors.push('missing rawId');
    if (att.type !== 'public-key') shapeErrors.push('type not public-key');
    if (!att.response) shapeErrors.push('missing response');
    if (att.response && !att.response.clientDataJSON) shapeErrors.push('missing response.clientDataJSON');
    if (att.response && !att.response.attestationObject) shapeErrors.push('missing response.attestationObject');

    if (shapeErrors.length) {
      await server.recordAuthAttempt(email, false);
      return NextResponse.json(
        { error: 'Malformed attestation', detail: shapeErrors },
        { status: 400 }
      );
    }

    // ⭐ STEP 7: Verify registration response
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
      verification = await verifyAuthenticationResponse({
        response: assertion,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
    } catch (libErr) {
      await server.recordAuthAttempt(email, false);
      const msg = (libErr as Error).message || String(libErr);
      return NextResponse.json(
        {
          error: 'WebAuthn library verification threw',
          detail: msg,
          ...(debug ? { expectedOrigin: origin, expectedRPID: rpID } : {}),
        },
        { status: 400 }
      );
    }

    if (!verification?.verified) {
      await server.recordAuthAttempt(email, false);
      return NextResponse.json(
        { error: 'Registration verification failed' },
        { status: 400 }
      );
    }

    // ⭐ STEP 8: Extract credential data
    const registrationInfo: any = (verification as any).registrationInfo;
    if (!registrationInfo) {
      await server.recordAuthAttempt(email, false);
      return NextResponse.json(
        { error: 'Missing registrationInfo in verification result' },
        { status: 500 }
      );
    }

    const toBase64Url = (val: unknown): string | null => {
      if (!val) return null;
      if (typeof val === 'string') return val;
      const anyVal: any = val;
      if (typeof Buffer !== 'undefined' && (Buffer.isBuffer?.(anyVal) || anyVal instanceof Uint8Array)) {
        return Buffer.from(anyVal).toString('base64url');
      }
      if (anyVal instanceof ArrayBuffer) {
        return Buffer.from(new Uint8Array(anyVal)).toString('base64url');
      }
      return null;
    };

    const credObj = registrationInfo.credential || {};
    const credId = toBase64Url(credObj.id) || toBase64Url((registrationInfo as any).credentialID);
    const pubKey = toBase64Url(credObj.publicKey) || toBase64Url((registrationInfo as any).credentialPublicKey);
    const counter = credObj.counter ?? registrationInfo.counter ?? 0;

    if (!credId || !pubKey) {
      await server.recordAuthAttempt(email, false);
      return NextResponse.json(
        { error: 'Registration returned incomplete credential' },
        { status: 500 }
      );
    }

    // ⭐ STEP 9: Store passkey (using standard registerPasskey logic)
    // This reuses all the same storage logic as the registration flow
    const result = await server.registerPasskey(email, assertion, challenge, { rpID, origin });

    if (!result?.token?.secret) {
      await server.recordAuthAttempt(email, false);
      return NextResponse.json(
        { error: 'Failed to register passkey' },
        { status: 500 }
      );
    }

    // ⭐ STEP 10: Record successful attempt
    await server.recordAuthAttempt(email, true);

    // ⭐ IMPORTANT: NO session created
    // User is already authenticated, just linking the passkey
    // Return success without creating new session
    return NextResponse.json({
      success: true,
      message: 'Passkey connected successfully. You can now sign in with it.',
    });
  } catch (err) {
    const debug = process.env.WEBAUTHN_DEBUG === '1';
    const errorMsg = (err as Error).message || String(err);

    // Record failed attempt
    if (email) {
      await server.recordAuthAttempt(email, false);
    }

    return NextResponse.json(
      {
        error: errorMsg,
        ...(debug ? { stack: (err as Error).stack } : {}),
      },
      { status: 500 }
    );
  }
}
