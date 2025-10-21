import { NextResponse } from 'next/server';
import { rateLimit, buildRateKey } from '../../../../../lib/rateLimit';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { issueChallenge } from '../../../../../lib/passkeys';
import crypto from 'crypto';

// Issues WebAuthn registration (attestation) options.
// Uses persistent storage (Appwrite DB) when configured; otherwise in-memory.
// Applies basic rate limiting per IP.
export async function POST(req: Request) {
  try {
    const { userId: rawUserId, userName } = await req.json();
    const userId = String(rawUserId).trim().toLowerCase();
    if (!userId || !userName) return NextResponse.json({ error: 'userId and userName required' }, { status: 400 });

    const rpName = process.env.NEXT_PUBLIC_RP_NAME || 'Appwrite Passkey';
    // Block passkey registration if account exists without passkeys
    const { PasskeyServer } = await import('../../../../../lib/passkey-server');
    const gate = new PasskeyServer();
    if (await gate.shouldBlockPasskeyForEmail(userId)) {
      // Check if the account has a wallet preference
      const hasWallet = await gate.hasWalletPreference(userId);
      const errorMessage = hasWallet 
        ? 'Account already connected with wallet'
        : 'Account already exists';
      return NextResponse.json({ error: errorMessage }, { status: 403 });
    }
    // Prefer dynamic RP based on host header for dev/proxy environments
    const url = new URL(req.url);
    const forwardedHost = req.headers.get('x-forwarded-host');
    const hostHeader = forwardedHost || req.headers.get('host') || url.host;
    const hostNoPort = hostHeader.split(':')[0];
    const rpID = process.env.NEXT_PUBLIC_RP_ID || hostNoPort || 'localhost';

    // Use userId as provided by caller (email) only for label; actual WebAuthn user handle should be Appwrite user $id.
    // For options we keep the deterministic binary for compatibility; verify route will bind to the server-created user.
    const userIdHash = crypto.createHash('sha256').update(String(userId)).digest();
    const userIdBuffer = new Uint8Array(Buffer.from(userIdHash));

    // Rate limiting (registration options request)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const windowMs = parseInt(process.env.WEBAUTHN_RATE_LIMIT_WINDOW_MS || '60000', 10); // default 60s
    const max = parseInt(process.env.WEBAUTHN_RATE_LIMIT_MAX || '10', 10); // default 10 per window
    const rl = rateLimit(buildRateKey(['webauthn','register','options', ip]), max, windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many registration attempts. Please wait.' }, { status: 429, headers: { 'Retry-After': Math.ceil((rl.reset - Date.now())/1000).toString() } });
    }

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: userIdBuffer,
      userName,
      attestationType: 'none',
      authenticatorSelection: {
        userVerification: 'preferred',
      },
      // You can set pubKeyCredParams, timeout, etc.
    });

        // Stateless signed challenge token (no server storage)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const issued = issueChallenge(userId, parseInt(process.env.WEBAUTHN_CHALLENGE_TTL_MS || '120000', 10));
    (options as any).challengeToken = issued.challengeToken;
    // Replace raw challenge with issued.challenge to keep same semantics (generateRegistrationOptions already produced a challenge we ignore now)
    (options as any).challenge = issued.challenge;
    // Ensure user.id is a base64url string since JSON loses Buffer semantics
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (options as any).user.id = Buffer.from(userIdHash).toString('base64url');

    return NextResponse.json(options);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || String(err) }, { status: 500 });
  }
}
