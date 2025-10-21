import { Client, Users, ID, Query } from 'node-appwrite';
import crypto from 'crypto';
import * as SimpleWebAuthnServer from '@simplewebauthn/server';
import * as SimpleWebAuthnServerHelpers from '@simplewebauthn/server/helpers';
import { AuthRateLimit } from './auth-rate-limit';

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
  private rateLimit: AuthRateLimit;

  constructor() {
    this.rateLimit = new AuthRateLimit(users);
  }
  async getUserIfExists(email: string): Promise<any | null> {
    const usersList = await users.list([Query.equal('email', email), Query.limit(1)]);
    return (usersList as any).users?.[0] ?? null;
  }

  private parseCredsMap(str: string | undefined): Record<string, string> {
    if (!str) return {};
    try { return JSON.parse(str) as Record<string, string>; } catch { return {}; }
  }

  async shouldBlockPasskeyForEmail(email: string): Promise<boolean> {
    const user = await this.getUserIfExists(email);
    if (!user) return false;
    const credsObj = this.parseCredsMap(user.prefs?.passkey_credentials as string | undefined);
    const hasPasskeys = Object.keys(credsObj).length > 0;
    // Block passkey registration/operations if account exists but has NO passkeys
    // (whether it has wallet or any other auth method)
    return !hasPasskeys;
  }
  async prepareUser(email: string) {
    // Find existing by email
    const usersList = await users.list([Query.equal('email', email), Query.limit(1)]);
    if ((usersList as any).users?.length > 0) {
      return (usersList as any).users[0];
    }
    // Create with Appwrite unique ID
    return await users.create(ID.unique(), email);
  }

  async registerPasskey(
    email: string,
    credentialData: any,
    challenge: string,
    opts?: { rpID?: string; origin?: string }
  ) {
    // Block if account exists without passkeys
    if (await this.shouldBlockPasskeyForEmail(email)) {
      throw new Error('Account already exists');
    }
    // Prepare user (create new or retrieve if it has passkeys)
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
    const credentialsStr = (existingPrefs.passkey_credentials || '') as string;
    const countersStr = (existingPrefs.passkey_counter || '') as string;

    // Parse existing credentials and counters (JSON objects stored as strings)
    const credObj: Record<string, string> = credentialsStr ? (JSON.parse(credentialsStr) as Record<string, string>) : {};
    const counterObj: Record<string, number> = countersStr ? (JSON.parse(countersStr) as Record<string, number>) : {};
    
    // Add new passkey
    credObj[passkeyData.id] = passkeyData.publicKey;
    counterObj[passkeyData.id] = passkeyData.counter;
    
    // Serialize back to strings
    // Merge existing prefs to avoid overwriting unrelated keys (e.g., walletEth)
    const mergedPrefs = { ...(user.prefs || {}) } as Record<string, unknown>;
    mergedPrefs.passkey_credentials = JSON.stringify(credObj);
    mergedPrefs.passkey_counter = JSON.stringify(counterObj);
    await users.updatePrefs(user.$id, mergedPrefs);

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
    const credentialsStr = (user.prefs?.passkey_credentials || '') as string;
    const countersStr = (user.prefs?.passkey_counter || '') as string;

    if (!credentialsStr) {
      throw new Error('No passkeys found for user');
    }
    
    // Parse credentials and counters (JSON strings)
    const credObj: Record<string, string> = JSON.parse(credentialsStr) as Record<string, string>;
    const counterObj: Record<string, number> = countersStr ? (JSON.parse(countersStr) as Record<string, number>) : {};
    
    // Find matching credential
    const credentialId = assertion.rawId || assertion.id;
    const publicKey = credObj[credentialId];
    const counter = counterObj[credentialId] || 0;
    
    if (!publicKey) {
      throw new Error('Unknown credential');
    }

    // Verify the WebAuthn authentication
    const verification = await (SimpleWebAuthnServer.verifyAuthenticationResponse as any)({
      response: assertion,
      expectedChallenge: challenge,
      expectedOrigin: opts?.origin || process.env.NEXT_PUBLIC_ORIGIN || 'http://localhost:3000',
      expectedRPID: opts?.rpID || process.env.NEXT_PUBLIC_RP_ID || 'localhost',
      // Library expects `credential` object with id/publicKey/counter
      credential: {
        counter: counter,
        id: Buffer.from(credentialId, 'base64url'),
        publicKey: Buffer.from(publicKey, 'base64url'),
      }
    });

    if (!verification.verified) {
      throw new Error('Authentication verification failed');
    }

    // Update counter in auth helper (guard if missing)
    const authInfo: any = (verification as any).authenticationInfo;
    const newCounter = (authInfo && typeof authInfo.newCounter === 'number') ? authInfo.newCounter : counter;
    
    // ⭐ CRITICAL: Detect cloned passkey (counter regression)
    if (newCounter < counter) {
      // Counter went backwards = passkey was cloned and used elsewhere!
      // This is a strong indicator of compromise
      throw new Error('Potential passkey compromise detected. Counter regression. This credential has been used elsewhere. Please reset your account.');
    }
    
    counterObj[credentialId] = newCounter;
    // Merge existing prefs to avoid dropping other keys (e.g., passkey_credentials)
    const mergedPrefs = { ...(user.prefs || {}) } as Record<string, unknown>;
    mergedPrefs.passkey_counter = JSON.stringify(counterObj);
    
    // ⭐ NEW: Store counter history for forensics (doesn't affect backwards compatibility)
    const counterHistoryStr = (user.prefs?.passkey_counter_history || '') as string;
    let counterHistory: Record<string, Array<{ timestamp: number; counter: number }>> = {};
    if (counterHistoryStr) {
      try {
        counterHistory = JSON.parse(counterHistoryStr);
      } catch {
        counterHistory = {};
      }
    }
    
    if (!counterHistory[credentialId]) {
      counterHistory[credentialId] = [];
    }
    
    counterHistory[credentialId].push({
      timestamp: Date.now(),
      counter: newCounter,
    });
    
    // Keep only last 50 counter entries per credential (prevent unbounded growth)
    if (counterHistory[credentialId].length > 50) {
      counterHistory[credentialId] = counterHistory[credentialId].slice(-50);
    }
    
    mergedPrefs.passkey_counter_history = JSON.stringify(counterHistory);
    await users.updatePrefs(user.$id, mergedPrefs);

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
    const credentialsStr = (user.prefs?.passkey_credentials || '') as string;
    if (!credentialsStr) return [];
    const credObj: Record<string, string> = JSON.parse(credentialsStr) as Record<string, string>;
    return Object.entries(credObj).map(([id, pk]) => ({ id, publicKey: pk, counter: 0 }));
  }

  /**
   * Check rate limit for auth attempt (call before attempting auth)
   */
  async checkAuthRateLimit(email: string): Promise<{
    allowed: boolean;
    status: string;
    attemptsRemaining: number;
    attemptsTotal: number;
    message: string | null;
  }> {
    const user = await this.getUserIfExists(email);
    if (!user) {
      // New user, no rate limit
      return {
        allowed: true,
        status: 'normal',
        attemptsRemaining: 10,
        attemptsTotal: 10,
        message: null,
      };
    }

    const result = await this.rateLimit.checkRateLimit(user, 'passkey');
    return {
      allowed: result.allowed,
      status: result.status,
      attemptsRemaining: result.attemptsRemaining,
      attemptsTotal: result.attemptsTotal,
      message: result.message,
    };
  }

  /**
   * Record an auth attempt (call after auth attempt, regardless of success)
   */
  async recordAuthAttempt(email: string, success: boolean): Promise<void> {
    const user = await this.getUserIfExists(email);
    if (user) {
      await this.rateLimit.recordAuthAttempt(user, 'passkey', success);
    }
  }

  /**
   * Reset rate limit (admin action, e.g., after email verification)
   */
  async resetAuthRateLimit(email: string): Promise<void> {
    const user = await this.getUserIfExists(email);
    if (user) {
      await this.rateLimit.resetRateLimit(user);
    }
  }