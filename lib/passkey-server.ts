import { Client, Users, ID } from 'node-appwrite';
import * as SimpleWebAuthnServer from '@simplewebauthn/server';
import * as SimpleWebAuthnServerHelpers from '@simplewebauthn/server/helpers';

const client = new Client();
client
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT!)
  .setKey(process.env.APPWRITE_API!);

const users = new Users(client);

export class PasskeyServer {
  async prepareUser(email: string) {
    try {
      // Try to find existing user by email
      const usersList = await users.list([`email=${email}`]);
      if (usersList.users.length > 0) {
        return usersList.users[0];
      }
    } catch (error) {
      // User doesn't exist, will create new one
    }

    // Create new user
    return await users.create(ID.unique(), email);
  }

  async registerPasskey(email: string, credentialData: any, challenge: string) {
    // Prepare user
    const user = await this.prepareUser(email);

    // Verify the WebAuthn registration
    const verification = await SimpleWebAuthnServer.verifyRegistrationResponse({
      response: credentialData,
      expectedChallenge: challenge,
      expectedOrigin: process.env.NEXT_PUBLIC_ORIGIN || 'http://localhost:3000',
      expectedRPID: process.env.NEXT_PUBLIC_RP_ID || 'localhost'
    });

    if (!verification.verified) {
      throw new Error('Registration verification failed');
    }

    // Store passkey in user preferences
    const { registrationInfo } = verification;
    const passkeyData = {
      id: SimpleWebAuthnServerHelpers.isoUint8Array.toHex(registrationInfo.credentialID),
      publicKey: SimpleWebAuthnServerHelpers.isoUint8Array.toHex(registrationInfo.credentialPublicKey),
      counter: registrationInfo.counter,
      transports: credentialData.response.transports || []
    };

    // Get existing passkeys
    const existingPrefs = user.prefs || {};
    const passkeys = existingPrefs.passkeys || [];
    
    // Add new passkey
    passkeys.push(passkeyData);
    
    // Update user preferences
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

  async authenticatePasskey(email: string, assertion: any, challenge: string) {
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
    const verification = await SimpleWebAuthnServer.verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge: challenge,
      expectedOrigin: process.env.NEXT_PUBLIC_ORIGIN || 'http://localhost:3000',
      expectedRPID: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
      authenticator: {
        counter: passkey.counter,
        credentialID: SimpleWebAuthnServerHelpers.isoUint8Array.fromHex(passkey.id),
        credentialPublicKey: SimpleWebAuthnServerHelpers.isoUint8Array.fromHex(passkey.publicKey)
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
}