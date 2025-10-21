/**
 * Enable Passkey
 * 
 * Endpoint: POST /api/webauthn/passkeys/enable
 * 
 * Purpose: Re-enable a previously disabled passkey.
 * 
 * Body: {
 *   email: string,
 *   credentialId: string
 * }
 * 
 * Response: { success: true }
 */

export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { PasskeyServer } from '../../../../../lib/passkey-server';

export async function POST(req: Request) {
  const server = new PasskeyServer();

  try {
    const { email, credentialId } = await req.json();

    if (!email || !credentialId) {
      return NextResponse.json(
        { error: 'email and credentialId required' },
        { status: 400 }
      );
    }

    await server.enablePasskey(email.toLowerCase(), credentialId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const errorMsg = (err as Error).message || String(err);
    return NextResponse.json(
      { error: errorMsg },
      { status: 400 }
    );
  }
}
