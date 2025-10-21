/**
 * List User's Passkeys with Metadata
 * 
 * Endpoint: GET /api/webauthn/passkeys/list
 * 
 * Purpose: List all passkeys for the authenticated user with metadata.
 * 
 * Query: email (user's email)
 * 
 * Response: Array of passkeys with metadata
 * {
 *   id: string (credentialId),
 *   name: string,
 *   createdAt: number (timestamp),
 *   lastUsedAt: number | null (timestamp),
 *   status: 'active' | 'disabled' | 'compromised'
 * }
 */

export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { PasskeyServer } from '../../../../../lib/passkey-server';

export async function GET(req: Request) {
  const server = new PasskeyServer();

  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'email query parameter required' },
        { status: 400 }
      );
    }

    const passkeys = await server.listPasskeysWithMetadata(email.toLowerCase());
    return NextResponse.json({ passkeys });
  } catch (err) {
    const errorMsg = (err as Error).message || String(err);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
