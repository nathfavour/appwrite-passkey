import { NextResponse } from 'next/server';
import { rateLimit, buildRateKey } from '../../../../../lib/rateLimit';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { saveChallenge } from '../../../../../lib/webauthnRepo';
import crypto from 'crypto';

// Issues WebAuthn registration (attestation) options.
// Uses persistent storage (Appwrite DB) when configured; otherwise in-memory.
// Applies basic rate limiting per IP.
export async function POST(req: Request) {
  try {
    const { userId, userName } = await req.json();
    if (!userId || !userName) return NextResponse.json({ error: 'userId and userName required' }, { status: 400 });

    const rpName = process.env.NEXT_PUBLIC_RP_NAME || 'Appwrite Passkey';
    const rpID = process.env.NEXT_PUBLIC_RP_ID || 'localhost';

    // Per simplewebauthn guidance, use a binary user ID (ArrayBuffer/Buffer) instead of a string.
    // Derive a deterministic binary id from the provided userId (e.g. email) via SHA-256.
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

    // Store challenge to validate later (keep challenge keyed by the app-level userId string)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    saveChallenge(userId, (options as any).challenge);

    return NextResponse.json(options);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || String(err) }, { status: 500 });
  }
}
