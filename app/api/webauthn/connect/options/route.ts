/**
 * Connect Passkey to Existing Session
 * 
 * Endpoint: POST /api/webauthn/connect/options
 * 
 * Purpose: Generate WebAuthn registration options for connecting a passkey
 * to an existing authenticated user session.
 * 
 * Flow:
 * 1. Verify user has active session (required)
 * 2. Verify session user matches requested email (prevent hijacking)
 * 3. Generate registration options (same as standard registration)
 * 4. Stateless challenge token (no session creation)
 * 
 * Body: { email: string }
 * Response: WebAuthn registration options + challengeToken
 * 
 * Differences from /api/webauthn/register/options:
 * - Requires active session
 * - Verifies session user matches email parameter
 * - No session created at end (user already has one)
 * - Same security as registration flow
 */

import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { issueChallenge } from '../../../../../lib/passkeys';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { email: rawEmail } = await req.json();
    const email = String(rawEmail).trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        { error: 'email required' },
        { status: 400 }
      );
    }

    const rpName = process.env.NEXT_PUBLIC_RP_NAME || 'Appwrite Passkey';
    
    const url = new URL(req.url);
    const forwardedHost = req.headers.get('x-forwarded-host');
    const hostHeader = forwardedHost || req.headers.get('host') || url.host;
    const hostNoPort = hostHeader.split(':')[0];
    const rpID = process.env.NEXT_PUBLIC_RP_ID || hostNoPort || 'localhost';

    // User handle (same as registration)
    const userIdHash = crypto.createHash('sha256').update(email).digest();
    const userIdBuffer = new Uint8Array(Buffer.from(userIdHash));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: userIdBuffer,
      userName: email,
      attestationType: 'none',
      authenticatorSelection: {
        userVerification: 'preferred',
      },
    });

    // Create stateless challenge (same as registration)
    const issued = issueChallenge(
      email,
      parseInt(process.env.WEBAUTHN_CHALLENGE_TTL_MS || '120000', 10)
    );

    (options as any).challengeToken = issued.challengeToken;
    (options as any).challenge = issued.challenge;
    (options as any).user.id = Buffer.from(userIdHash).toString('base64url');

    return NextResponse.json(options);
  } catch (err) {
    const debug = process.env.WEBAUTHN_DEBUG === '1';
    const errorMsg = (err as Error).message || String(err);
    return NextResponse.json(
      {
        error: errorMsg,
        ...(debug ? { stack: (err as Error).stack } : {}),
      },
      { status: 500 }
    );
  }
}
