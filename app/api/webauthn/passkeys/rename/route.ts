/**
 * Rename Passkey
 * 
 * Endpoint: POST /api/webauthn/passkeys/rename
 * 
 * Purpose: Rename a passkey with a user-friendly name.
 * 
 * Body: {
 *   email: string,
 *   credentialId: string,
 *   name: string (max 50 chars)
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
    const { email, credentialId, name } = await req.json();

    if (!email || !credentialId || !name) {
      return NextResponse.json(
        { error: 'email, credentialId, and name required' },
        { status: 400 }
      );
    }

    await server.renamePasskey(email.toLowerCase(), credentialId, name);
    return NextResponse.json({ success: true });
  } catch (err) {
    const errorMsg = (err as Error).message || String(err);
    return NextResponse.json(
      { error: errorMsg },
      { status: 400 }
    );
  }
}
