import { Client, Users, ID, Query } from 'node-appwrite';
import crypto from 'crypto';
import * as SimpleWebAuthnServer from '@simplewebauthn/server';
import * as SimpleWebAuthnServerHelpers from '@simplewebauthn/server/helpers';

const client = new Client();
const serverEndpoint = process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const serverProject = process.env.APPWRITE_PROJECT || process.env.NEXT_PUBLIC_APPWRITE_PROJECT || '';
const serverApiKey = process.env.APPWRITE_API || process.env.APPWRITE_API_KEY || '';

client.setEndpoint(serverEndpoint);
if (!serverProject) {
  throw new Error('Missing APPWRITE_PROJECT or NEXT_PUBLIC_APPWRITE_PROJECT');
}
client.setProject(serverProject);
if (!serverApiKey) {
  throw new Error('Missing APPWRITE_API or APPWRITE_API_KEY');
}
client.setKey(serverApiKey);

const users = new Users(client);

export class PasskeyServer {
  private deriveUserId(email: string): string {
    const hash = crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('base64url');
    // Ensure <= 36 chars, valid charset, non-special start
    return `pk_${hash.slice(0, 32)}`;
  }

  async prepareUser(email: string) {
    const userId = this.deriveUserId(email);
    // Try deterministic ID first
    try {
      return await users.get(userId);
    } catch {}
    // Fallback: find by email (in case user was created before)
    const usersList = await users.list([Query.equal('email', email), Query.limit(1)]);
    if ((usersList as any).users?.length > 0) {
      return (usersList as any).users[0];
    }
    // Create with deterministic custom ID
    return await users.create(ID.custom(userId), email);
  }

  async registerPasskey(
    email: string,
    credentialData: any,
    challenge: string,
    opts?: { rpID?: string; origin?: string }
  ) {
    // Prepare user
    const user = await this.prepareUser(email);

    // Verify the WebAuthn registration
    const verification = await (SimpleWebAuthnServer.verifyRegistrationResponse as any)({
      response: credentialData,
      expectedChallenge: challenge,
      expectedOrigin: opts?.origin || process.env.NEXT_PUBLIC_ORIGIN || 'http://localhost:3000',
      expectedRPID: opts?.rpID || process.env.NEXT_PUBLIC_RP_ID || 'localhost'
    });

    if (!verification.verified) {
      throw new Error('Registration verification failed');
    }

    // Store passkey in user preferences (support server v7/v8 shapes)
    const registrationInfo: any = (verification as any).registrationInfo;
    const cred = registrationInfo?.credential || {};
    const passkeyData = {
      id: typeof cred.id === 'string' ? cred.id : Buffer.from(cred.id || new Uint8Array()).toString('base64url'),
      publicKey: Buffer.from(cred.publicKey || new Uint8Array()).toString('base64url'),
      counter: typeof cred.counter === 'number' ? cred.counter : (registrationInfo.counter || 0),
      transports: Array.isArray(cred.transports) ? cred.transports : (credentialData.response?.transports || [])
    };
    if (!passkeyData.id || !passkeyData.publicKey) {
      throw new Error('RegistrationInfo missing credential id/publicKey');
    }

    // Get existing passkeys
    const existingPrefs = user.prefs || {};
    // If prefs.passkeys is a stringified JSON, parse it, else if it's an object use it, otherwise init array
    let passkeys: Array<{ id: string; publicKey: string; counter: number; transports?: string[] }> = [];
    const raw = (existingPrefs as any).passkeys;
    if (Array.isArray(raw)) {
      passkeys = raw;
    } else if (typeof raw === 'string' && raw.trim().startsWith('[')) {
      try { passkeys = JSON.parse(raw); } catch { passkeys = []; }
    }
    
    // Add new passkey
    passkeys.push(passkeyData);
    
    // Update user preferences
    // Store as a proper JSON array, not [object Object]
    await users.updatePrefs(user.$id, { passkeys });

    // Create custom token
    const token = await users.createToken(user.$id, 64, 60);

    return {
      success: true,
      token: {
        secret: token.secret,
        userId: user.$id
      }
    };
  }

  async authenticatePasskey(
    email: string,
    assertion: any,
    challenge: string,
    opts?: { rpID?: string; origin?: string }
  ) {
    // Prepare user
    const user = await this.prepareUser(email);

    // Get stored passkeys
    const passkeys = user.prefs?.passkeys || [];
    
    if (passkeys.length === 0) {
      throw new Error('No passkeys found for user');
    }

    // Find matching passkey
    const credentialId = assertion.rawId || assertion.id;
    const passkey = passkeys.find(p => p.id === credentialId);
    
    if (!passkey) {
      throw new Error('Unknown credential');
    }

    // Verify the WebAuthn authentication
    const verification = await (SimpleWebAuthnServer.verifyAuthenticationResponse as any)({
      response: assertion,
      expectedChallenge: challenge,
      expectedOrigin: opts?.origin || process.env.NEXT_PUBLIC_ORIGIN || 'http://localhost:3000',
      expectedRPID: opts?.rpID || process.env.NEXT_PUBLIC_RP_ID || 'localhost',
      authenticator: {
        counter: passkey.counter,
        credentialID: Buffer.from(passkey.id, 'base64url'),
        credentialPublicKey: Buffer.from(passkey.publicKey, 'base64url')
      }
    });

    if (!verification.verified) {
      throw new Error('Authentication verification failed');
    }

    // Update counter
    const updatedPasskeys = passkeys.map(p => 
      p.id === credentialId 
        ? { ...p, counter: verification.authenticationInfo.newCounter }
        : p
    );
    
    await users.updatePrefs(user.$id, { passkeys: updatedPasskeys });

    // Create custom token
    const token = await users.createToken(user.$id, 64, 60);

    return {
      success: true,
      token: {
        secret: token.secret,
        userId: user.$id
      }
    };
  }

  async getPasskeysByEmail(email: string): Promise<Array<{ id: string; publicKey: string; counter: number }>> {
    const user = await this.prepareUser(email);
    const raw = (user.prefs as any)?.passkeys;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return []; }
    }
    return [];
  }
}