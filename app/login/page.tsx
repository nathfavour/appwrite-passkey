"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthForm from '../components/AuthForm';
import { Client, Account } from 'appwrite';


const client = new Client();
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT) client.setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT);
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_APPWRITE_PROJECT) client.setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT);
const account = new Account(client);

function bufferToBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(base64url: string) {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + padding;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function publicKeyCredentialToJSON(pubKeyCred: unknown): unknown {
  if (Array.isArray(pubKeyCred)) return (pubKeyCred as unknown[]).map(publicKeyCredentialToJSON);
  if (pubKeyCred instanceof ArrayBuffer) return bufferToBase64Url(pubKeyCred);
  if (pubKeyCred && typeof pubKeyCred === 'object') {
    const obj: Record<string, unknown> = {};
    for (const key in (pubKeyCred as Record<string, unknown>)) {
      obj[key] = publicKeyCredentialToJSON((pubKeyCred as Record<string, unknown>)[key]);
    }
    return obj;
  }
  return pubKeyCred;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('user@example.com');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // For PoC we'll use the email as the userId on the server side.
  async function registerPasskey() {
    setMessage(null);
    if (!('credentials' in navigator)) {
      setMessage('WebAuthn is not supported in this browser');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/webauthn/register/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: email, userName: email.split('@')[0] }),
      });
      const options = await res.json();
      if (options.error) throw new Error(options.error);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const publicKey = { ...options } as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      publicKey.challenge = base64UrlToBuffer((options as any).challenge);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      publicKey.user.id = base64UrlToBuffer((options as any).user.id);

      if (publicKey.excludeCredentials) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        publicKey.excludeCredentials = publicKey.excludeCredentials.map((c: any) => ({
          ...c,
          id: base64UrlToBuffer(c.id),
        }));
      }

      const cred = await navigator.credentials.create({ publicKey });
      console.log('[CLIENT] Created credential raw object:', cred);
      if (!cred) throw new Error('Credential creation returned null');
      if (!(cred as any).response || !(cred as any).response.clientDataJSON) {
        console.warn('Unexpected credential object', cred);
        throw new Error('Browser did not return a proper attestation response');
      }
      const json = publicKeyCredentialToJSON(cred);

      const verifyRes = await fetch('/api/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: email, attestation: json, challenge: (options as any).challenge, challengeToken: (options as any).challengeToken }),
      });
      const verifyJson = await verifyRes.json();
      if (verifyJson.error) throw new Error(verifyJson.error);

      // If server issued a custom token, exchange its secret for a session
      if (verifyJson.token?.secret && process.env.NEXT_PUBLIC_APPWRITE_PROJECT && process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT) {
        try {
          // Exchange custom Appwrite user token secret for a session
          await account.createSession({ userId: verifyJson.token.userId || email, secret: verifyJson.token.secret });
          setMessage('Registration successful and session created. Redirecting...');
          router.replace('/');
          return;
        } catch (e) {
          setMessage('Token exchange failed, but registration succeeded. You may sign in now.');
        }
      }

      setMessage('Registration successful. You can now sign in with your passkey.');
    } catch (err) {
      setMessage((err as Error)?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function signInWithPasskey() {
    setMessage(null);
    if (!('credentials' in navigator)) {
      setMessage('WebAuthn is not supported in this browser');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/webauthn/auth/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: email }),
      });
      const options = await res.json();
      if (options.error) throw new Error(options.error);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const publicKey = { ...options } as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      publicKey.challenge = base64UrlToBuffer((options as any).challenge);
      if (publicKey.allowCredentials) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        publicKey.allowCredentials = publicKey.allowCredentials.map((c: any) => ({
          ...c,
          id: base64UrlToBuffer(c.id),
        }));
      }

      const assertion = await navigator.credentials.get({ publicKey });
      const json = publicKeyCredentialToJSON(assertion);

      const verifyRes = await fetch('/api/webauthn/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: email, assertion: json, challenge: (options as any).challenge, challengeToken: (options as any).challengeToken }),
      });
      const verifyJson = await verifyRes.json();
      if (verifyJson.error) throw new Error(verifyJson.error);

      // If server returned a custom token, exchange it for a session and redirect
      if (verifyJson.token?.secret && process.env.NEXT_PUBLIC_APPWRITE_PROJECT && process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT) {
        try {
          await account.createSession({ userId: verifyJson.token.userId || email, secret: verifyJson.token.secret });
          router.replace('/');
          return;
        } catch (e) {
          setMessage('Token exchange failed, but authentication succeeded (assertion verified).');
        }
      }

      setMessage('Authentication successful (PoC). Server verified assertion.');
    } catch (err) {
      setMessage((err as Error)?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return <AuthForm email={email} onEmailChangeAction={setEmail} onPasskeyAction={signInWithPasskey} onRegisterAction={registerPasskey} loading={loading} message={message} />;
}
