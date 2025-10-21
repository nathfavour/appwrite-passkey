/**
 * Disable Passkey
 * 
 * Endpoint: POST /api/webauthn/passkeys/disable
 * 
 * Purpose: Disable a passkey (soft delete). Passkey remains stored but cannot be used.
 * 
 * Body: {
 *   email: string,
 *   credentialId: string
 * }
 * 
 * Response: { success: true }
 * 
 * Note: Disabled passkeys can be re-enabled by renaming or deleting and re-creating.
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

    await server.disablePasskey(email.toLowerCase(), credentialId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const errorMsg = (err as Error).message || String(err);
    return NextResponse.json(
      { error: errorMsg },
      { status: 400 }
    );
  }
}
