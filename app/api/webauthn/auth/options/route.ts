import { NextResponse } from 'next/server';
import { rateLimit, buildRateKey } from '../../../../../lib/rateLimit';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { saveChallenge, getCredentialsByUser, type StoredCredential } from '../../../../../lib/webauthnRepo';

// Issues WebAuthn authentication (assertion) options.
// Persistent credential lookup if configured. Rate limited per IP + user.
export async function POST(req: Request) {
  try {
    const { userId: rawUserId } = await req.json();
    const userId = String(rawUserId).trim();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const rpID = process.env.NEXT_PUBLIC_RP_ID || 'localhost';

    // Rate limiting (authentication options)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const windowMs = parseInt(process.env.WEBAUTHN_RATE_LIMIT_WINDOW_MS || '60000', 10);
    const max = parseInt(process.env.WEBAUTHN_RATE_LIMIT_MAX || '15', 10); // allow slightly more for auth
    const rl = rateLimit(buildRateKey(['webauthn','auth','options', ip, userId]), max, windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many authentication attempts. Please wait.' }, { status: 429, headers: { 'Retry-After': Math.ceil((rl.reset - Date.now())/1000).toString() } });
    }

    const userCreds = await getCredentialsByUser(userId);
    const allowCredentials = userCreds.map((c: StoredCredential) => ({ id: c.id, type: 'public-key' }));

    const options = await generateAuthenticationOptions({
      allowCredentials,
      userVerification: 'preferred',
      rpID,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    saveChallenge(userId, (options as any).challenge);
    return NextResponse.json(options);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || String(err) }, { status: 500 });
  }
}
