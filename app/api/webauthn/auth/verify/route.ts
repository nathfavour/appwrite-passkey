export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { verifyChallengeToken, getPasskeys } from '../../../../../lib/passkeys';
import { PasskeyServer } from '../../../../../lib/passkey-server';
import { rateLimit, buildRateKey } from '../../../../../lib/rateLimit';

// Verifies WebAuthn authentication assertion and updates signature counter.
// On success, provides an Appwrite custom token for session creation.
// Integrates intelligent per-user rate limiting.
export async function POST(req: Request) {
  let userId = '';
  const server = new PasskeyServer();

  try {
    const { userId: rawUserId, assertion, challengeToken, challenge } = await req.json();
    userId = String(rawUserId).trim().toLowerCase();
    if (!userId || !assertion || !challengeToken || !challenge) return NextResponse.json({ error: 'userId, assertion, challenge and challengeToken required' }, { status: 400 });

    // ⭐ NEW: Check intelligent per-user rate limit FIRST
    const rateLimitCheck = await server.checkAuthRateLimit(userId);
    if (!rateLimitCheck.allowed) {
      // Record failed attempt before returning
      await server.recordAuthAttempt(userId, false);
      return NextResponse.json(
        { 
          error: rateLimitCheck.message || 'Rate limited',
          status: rateLimitCheck.status,
        },
        { 
          status: rateLimitCheck.status === 'limited' ? 429 : 429,
          headers: { 'Retry-After': '60' }
        }
      );
    }

    // Show warning if approaching limit
    if (rateLimitCheck.message) {
      // Include warning in response but allow auth to proceed
    }

    // Keep old IP-based rate limit for defense-in-depth
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const windowMs = parseInt(process.env.WEBAUTHN_RATE_LIMIT_WINDOW_MS || '60000', 10);
    const max = parseInt(process.env.WEBAUTHN_RATE_LIMIT_MAX || '30', 10);
    const rl = rateLimit(buildRateKey(['webauthn','auth','verify', ip, userId]), max, windowMs);
    if (!rl.allowed) {
      await server.recordAuthAttempt(userId, false);
      return NextResponse.json({ error: 'Too many authentication attempts. Please wait.' }, { status: 429, headers: { 'Retry-After': Math.ceil((rl.reset - Date.now())/1000).toString() } });
    }

    // Stateless challenge validation
    try {
      verifyChallengeToken(userId, challenge, challengeToken);
    } catch (e) {
      await server.recordAuthAttempt(userId, false);
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

    // Basic shape validation before library call
    if (typeof assertion !== 'object' || !assertion) {
      return NextResponse.json({ error: 'Malformed assertion: not an object' }, { status: 400 });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(assertion as any).response || !(assertion as any).response.clientDataJSON) {
      return NextResponse.json({ error: 'Malformed assertion: missing response.clientDataJSON' }, { status: 400 });
    }
    const debug = process.env.WEBAUTHN_DEBUG === '1';

    // server.authenticatePasskey will update counter and mint custom token
    const result = await server.authenticatePasskey(userId, assertion, challenge, { rpID, origin });
    if (!result?.token?.secret) {
      await server.recordAuthAttempt(userId, false);
      return NextResponse.json({ error: 'Failed to create custom token' }, { status: 500 });
    }
    
    // ⭐ Record successful authentication
    await server.recordAuthAttempt(userId, true);
    
    return NextResponse.json({ success: true, token: result.token });
  } catch (err) {
    const debug = process.env.WEBAUTHN_DEBUG === '1';
    const errorMsg = (err as Error).message || String(err);
    
    // Record failed attempt
    if (userId) {
      await server.recordAuthAttempt(userId, false);
    }
    
    return NextResponse.json({ error: errorMsg, ...(debug ? { stack: (err as Error).stack } : {}) }, { status: 500 });
  }
}
