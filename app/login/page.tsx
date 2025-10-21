'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthForm from '../components/AuthForm';
import { Client, Account } from 'appwrite';
import Link from 'next/link';
import { Box, Typography, Grid, Stack } from '@mui/material';


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
      const publicKey: any = { ...options };
      // Ensure binary fields are ArrayBuffers
      publicKey.challenge = base64UrlToBuffer(options.challenge as string);
      publicKey.user.id = base64UrlToBuffer((options as any).user.id as string);

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
        // Ensure we pass the original attestation object; library expects `response` wrapper
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

  // Unified one-button flow: try signin first, fallback to registration
  async function continueWithPasskey() {
    setMessage(null);
    if (!('credentials' in navigator)) {
      setMessage('WebAuthn is not supported in this browser');
      return;
    }
    setLoading(true);
    try {
      // 1) Probe sign-in capability
      const optRes = await fetch('/api/webauthn/auth/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: email }),
      });

      // Rate limited
      if (optRes.status === 429) {
        const retryAfter = optRes.headers.get('Retry-After') || '';
        setMessage(`Too many attempts. Retry after ${retryAfter || 'a moment'}.`);
        return;
      }
      // Wallet gate
      if (optRes.status === 403) {
        const body = await optRes.json().catch(() => ({}));
        setMessage(body?.error || 'Account already connected with wallet');
        return;
      }

      let doRegister = false;
      let authOptions: any = null;
      if (optRes.ok) {
        authOptions = await optRes.json();
        if (!Array.isArray(authOptions.allowCredentials) || authOptions.allowCredentials.length === 0) {
          doRegister = true;
        }
      } else {
        // Any non-429/403 failure → try registration
        doRegister = true;
      }

      if (!doRegister) {
        // 2) Sign-in path
        const publicKey: any = { ...authOptions };
        publicKey.challenge = base64UrlToBuffer(authOptions.challenge as string);
        if (publicKey.allowCredentials) {
          publicKey.allowCredentials = publicKey.allowCredentials.map((c: any) => ({
            ...c,
            id: base64UrlToBuffer(c.id),
          }));
        }

        try {
          const assertion = await navigator.credentials.get({ publicKey });
          const json = publicKeyCredentialToJSON(assertion);
          const verifyRes = await fetch('/api/webauthn/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: email, assertion: json, challenge: authOptions.challenge, challengeToken: authOptions.challengeToken }),
          });
          const verifyJson = await verifyRes.json();
          if (!verifyRes.ok) {
            if (verifyRes.status === 400 && (verifyJson?.error?.includes('Unknown credential') || verifyJson?.error?.includes('WebAuthn'))) {
              doRegister = true; // fallback
            } else if (verifyRes.status === 403) {
              setMessage(verifyJson?.error || 'Account already connected with wallet');
              return;
            } else {
              setMessage(verifyJson?.error || 'Sign-in failed');
              return;
            }
          } else {
            // Token to session
            if (verifyJson.token?.secret) {
              await account.createSession({ userId: verifyJson.token.userId || email, secret: verifyJson.token.secret });
              router.replace('/');
              return;
            }
            setMessage('Sign-in verified. No token returned.');
            return;
          }
        } catch (e) {
          // User canceled or browser error → try registration path
          doRegister = true;
        }
      }

      // 3) Registration path
      const regRes = await fetch('/api/webauthn/register/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: email, userName: email.split('@')[0] || email }),
      });
      if (regRes.status === 429) {
        const retryAfter = regRes.headers.get('Retry-After') || '';
        setMessage(`Too many attempts. Retry after ${retryAfter || 'a moment'}.`);
        return;
      }
      if (regRes.status === 403) {
        const body = await regRes.json().catch(() => ({}));
        setMessage(body?.error || 'Account already connected with wallet');
        return;
      }
      const regOpt = await regRes.json();
      if (!regRes.ok || regOpt?.error) {
        setMessage(regOpt?.error || 'Could not start registration');
        return;
      }

      const regPK: any = { ...regOpt };
      regPK.challenge = base64UrlToBuffer(regOpt.challenge as string);
      if (regPK.user?.id) regPK.user.id = base64UrlToBuffer(regOpt.user.id as string);
      if (regPK.excludeCredentials) {
        regPK.excludeCredentials = regPK.excludeCredentials.map((c: any) => ({ ...c, id: base64UrlToBuffer(c.id) }));
      }

      const created = await navigator.credentials.create({ publicKey: regPK });
      const createdJson = publicKeyCredentialToJSON(created);
      const regVerify = await fetch('/api/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: email, attestation: createdJson, challenge: regOpt.challenge, challengeToken: regOpt.challengeToken }),
      });
      const regVerifyJson = await regVerify.json();
      if (!regVerify.ok) {
        setMessage(regVerifyJson?.error || 'Registration failed');
        return;
      }
      if (regVerifyJson.token?.secret) {
        await account.createSession({ userId: regVerifyJson.token.userId || email, secret: regVerifyJson.token.secret });
        router.replace('/');
        return;
      }
      setMessage('Registration successful. You can now sign in.');
    } catch (err) {
      setMessage((err as Error)?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  // Wire the one-button flow to the primary action; keep register action available to avoid breaking existing flows
  // Single-button mode: only provide onPasskeyAction so the form renders a single "Continue with Passkey" button
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)' }}>
      {/* Header with Logo */}
      <Box sx={{ p: 2 }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>🔐</span>
          </Box>
          <Typography
            sx={{
              fontSize: 18,
              fontWeight: 700,
              background: 'linear-gradient(90deg, #2563eb 0%, #4f46e5 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Passkey Demo
          </Typography>
        </Link>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, py: 3 }}>
        <Box sx={{ width: '100%', maxWidth: 1200 }}>
          <Grid container spacing={4} alignItems="center">
            {/* Left Side - Info */}
            <Grid item xs={12} lg={6} sx={{ display: { xs: 'none', lg: 'block' } }}>
              <Box>
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 700,
                    mb: 2,
                    lineHeight: 1.2,
                  }}
                >
                  Secure Authentication with{' '}
                  <Box
                    component="span"
                    sx={{
                      background: 'linear-gradient(90deg, #2563eb 0%, #4f46e5 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    Passkeys
                  </Box>
                </Typography>
                <Typography variant="h6" sx={{ color: '#64748b', mb: 4 }}>
                  Experience the future of authentication. Faster, more secure, and simpler than passwords.
                </Typography>

                <Stack spacing={2}>
                  {[
                    { icon: '🔐', title: 'End-to-End Encrypted', desc: 'Your keys never leave your device' },
                    { icon: '⚡', title: 'One-Click Login', desc: 'No passwords to remember or type' },
                    { icon: '🛡️', title: 'Phishing Resistant', desc: 'Cryptographic authentication' },
                    { icon: '📱', title: 'Multi-Device', desc: 'Add and manage multiple passkeys' },
                  ].map((item, idx) => (
                    <Box key={idx} sx={{ display: 'flex', gap: 2 }}>
                      <Box sx={{ fontSize: 24, flex: 'none' }}>{item.icon}</Box>
                      <Box>
                        <Typography sx={{ fontWeight: 600, color: '#1e293b' }}>
                          {item.title}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#64748b' }}>
                          {item.desc}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>

                <Box sx={{ mt: 4, pt: 4, borderTop: '1px solid #e2e8f0' }}>
                  <Typography variant="body2" sx={{ color: '#64748b' }}>
                    <strong style={{ color: '#1e293b' }}>Demo Features:</strong> Register with passkey, authenticate, add multiple passkeys, rename, delete, and disable them.
                  </Typography>
                </Box>
              </Box>
            </Grid>

            {/* Right Side - Form */}
            <Grid item xs={12} lg={6} sx={{ display: 'flex', justifyContent: 'center' }}>
              <AuthForm
                email={email}
                onEmailChangeAction={setEmail}
                onPasskeyAction={continueWithPasskey}
                loading={loading}
                message={message}
              />
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* Footer */}
      <Box sx={{ textAlign: 'center', py: 2, borderTop: '1px solid #e2e8f0', color: '#64748b', fontSize: 12 }}>
        <Typography variant="caption">
          Appwrite Passkey Demo • Built with Next.js & WebAuthn
        </Typography>
      </Box>
    </Box>
  );
}
