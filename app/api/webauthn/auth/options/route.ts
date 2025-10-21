import { NextResponse } from 'next/server';
import { rateLimit, buildRateKey } from '../../../../../lib/rateLimit';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { issueChallenge } from '../../../../../lib/passkeys';
import { PasskeyServer } from '../../../../../lib/passkey-server';

// Issues WebAuthn authentication (assertion) options.
// Persistent credential lookup if configured. Rate limited per IP + user.
export async function POST(req: Request) {
  try {
    const { userId: rawUserId } = await req.json();
    const userId = String(rawUserId).trim().toLowerCase();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    // Prefer dynamic RP based on host header for dev/proxy environments
    const url = new URL(req.url);
    const forwardedHost = req.headers.get('x-forwarded-host');
    const hostHeader = forwardedHost || req.headers.get('host') || url.host;
    const hostNoPort = hostHeader.split(':')[0];
    const rpID = process.env.NEXT_PUBLIC_RP_ID || hostNoPort || 'localhost';

    // Rate limiting (authentication options)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const windowMs = parseInt(process.env.WEBAUTHN_RATE_LIMIT_WINDOW_MS || '60000', 10);
    const max = parseInt(process.env.WEBAUTHN_RATE_LIMIT_MAX || '15', 10); // allow slightly more for auth
    const rl = rateLimit(buildRateKey(['webauthn','auth','options', ip, userId]), max, windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many authentication attempts. Please wait.' }, { status: 429, headers: { 'Retry-After': Math.ceil((rl.reset - Date.now())/1000).toString() } });
    }

    const server = new PasskeyServer();
    // Block passkey flow if account exists without passkeys
    if (await server.shouldBlockPasskeyForEmail(userId)) {
      // Check if the account has a wallet preference
      const hasWallet = await server.hasWalletPreference(userId);
      const errorMessage = hasWallet 
        ? 'Account already connected with wallet'
        : 'Account already exists';
      return NextResponse.json({ error: errorMessage }, { status: 403 });
    }
    const userCreds = await server.getPasskeysByEmail(userId);
    // Ensure ids are base64url strings for JSON output, the client will convert to ArrayBuffers
    const allowCredentials = userCreds
      .filter((c) => c && c.id && typeof c.id === 'string')
      .map((c) => ({ id: c.id, type: 'public-key' as const }));

    const options = await generateAuthenticationOptions({
      allowCredentials,
      userVerification: 'preferred',
      rpID,
    });

    // Stateless challenge
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const issued = issueChallenge(userId, parseInt(process.env.WEBAUTHN_CHALLENGE_TTL_MS || '120000', 10));
    (options as any).challengeToken = issued.challengeToken;
    (options as any).challenge = issued.challenge; // override challenge to one we control
    return NextResponse.json(options);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || String(err) }, { status: 500 });
  }
}
