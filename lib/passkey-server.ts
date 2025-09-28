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

    // Get existing auth helpers from prefs
    const existingPrefs = user.prefs || {};
    const credentials = (existingPrefs.passkey_credentials || '') as string;
    const counters = (existingPrefs.passkey_counter || '') as string;
    
    // Parse existing credentials and counters
    const credMap = new Map<string, string>();
    const counterMap = new Map<string, number>();
    
    if (credentials) {
      credentials.split(',').forEach(pair => {
        const [id, pk] = pair.split(':');
        if (id && pk) credMap.set(id, pk);
      });
    }
    
    if (counters) {
      counters.split(',').forEach(pair => {
        const [id, cnt] = pair.split(':');
        if (id && cnt) counterMap.set(id, parseInt(cnt, 10));
      });
    }
    
    // Add new passkey
    credMap.set(passkeyData.id, passkeyData.publicKey);
    counterMap.set(passkeyData.id, passkeyData.counter);
    
    // Serialize back to strings
    const newCredentials = Array.from(credMap.entries())
      .map(([id, pk]) => `${id}:${pk}`)
      .join(',');
    const newCounters = Array.from(counterMap.entries())
      .map(([id, cnt]) => `${id}:${cnt}`)
      .join(',');
    
    // Update user preferences with auth helpers
    await users.updatePrefs(user.$id, { 
      passkey_credentials: newCredentials,
      passkey_counter: newCounters
    });

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

    // Get auth helpers from prefs
    const credentials = (user.prefs?.passkey_credentials || '') as string;
    const counters = (user.prefs?.passkey_counter || '') as string;
    
    if (!credentials) {
      throw new Error('No passkeys found for user');
    }
    
    // Parse credentials and counters
    const credMap = new Map<string, string>();
    const counterMap = new Map<string, number>();
    
    credentials.split(',').forEach(pair => {
      const [id, pk] = pair.split(':');
      if (id && pk) credMap.set(id, pk);
    });
    
    counters.split(',').forEach(pair => {
      const [id, cnt] = pair.split(':');
      if (id && cnt) counterMap.set(id, parseInt(cnt, 10));
    });
    
    // Find matching credential
    const credentialId = assertion.rawId || assertion.id;
    const publicKey = credMap.get(credentialId);
    const counter = counterMap.get(credentialId) || 0;
    
    if (!publicKey) {
      throw new Error('Unknown credential');
    }

    // Verify the WebAuthn authentication
    const verification = await (SimpleWebAuthnServer.verifyAuthenticationResponse as any)({
      response: assertion,
      expectedChallenge: challenge,
      expectedOrigin: opts?.origin || process.env.NEXT_PUBLIC_ORIGIN || 'http://localhost:3000',
      expectedRPID: opts?.rpID || process.env.NEXT_PUBLIC_RP_ID || 'localhost',
      authenticator: {
        counter: counter,
        credentialID: Buffer.from(credentialId, 'base64url'),
        credentialPublicKey: Buffer.from(publicKey, 'base64url')
      }
    });

    if (!verification.verified) {
      throw new Error('Authentication verification failed');
    }

    // Update counter in auth helper
    const newCounter = verification.authenticationInfo.newCounter || counter;
    counterMap.set(credentialId, newCounter);
    
    const newCounters = Array.from(counterMap.entries())
      .map(([id, cnt]) => `${id}:${cnt}`)
      .join(',');
    
    await users.updatePrefs(user.$id, { passkey_counter: newCounters });

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
    const credentials = (user.prefs?.passkey_credentials || '') as string;
    
    if (!credentials) return [];
    
    // Parse credentials into array format for allowCredentials
    const result: Array<{ id: string; publicKey: string; counter: number }> = [];
    credentials.split(',').forEach(pair => {
      const [id, pk] = pair.split(':');
      if (id && pk) {
        result.push({ id, publicKey: pk, counter: 0 }); // counter not needed for allowCredentials
      }
    });
    
    return result;
  }
}