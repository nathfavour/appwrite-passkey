"use client";

import React, { useState } from 'react';

type Props = {
  email: string;
  onEmailChangeAction: (value: string) => void;
  onPasskeyAction: () => Promise<void> | void; // sign in handler
  onRegisterAction?: () => Promise<void> | void; // register handler
  loading?: boolean;
  message?: string | null;
};

export default function AuthForm({
  email,
  onEmailChangeAction,
  onPasskeyAction,
  onRegisterAction,
  loading = false,
  message,
}: Props) {
  const [mode, setMode] = useState<'signin' | 'register'>(onRegisterAction ? 'signin' : 'signin');
  const singleMode = !onRegisterAction;

  const primaryAction = async () => {
    if (mode === 'register' && onRegisterAction) return onRegisterAction();
    return onPasskeyAction();
  };

  const primaryLabel = singleMode
    ? 'Continue with Passkey'
    : mode === 'register'
      ? 'Register Passkey'
      : 'Sign In with Passkey';
  const switchLabel = mode === 'register' ? 'Have a passkey? Sign in' : 'Need a passkey? Register';

  return (
    <main style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          background: 'linear-gradient(180deg,#f6fbff,#ffffff)',
          border: '1px solid #dbeeff',
          borderRadius: 14,
          padding: 28,
          boxShadow: '0 8px 30px rgba(14,42,80,0.06)',
        }}
      >
        <header style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, marginBottom: 6, color: '#0f172a', fontSize: 24 }}>
            {singleMode ? 'Passkey' : mode === 'register' ? 'Register a New Passkey' : 'Passkey Sign In'}
          </h1>
          <p style={{ margin: 0, color: '#1e3a8a', fontSize: 14 }}>
            {singleMode
              ? 'Use a single button to sign in or register with your device passkey.'
              : mode === 'register'
                ? 'Create a passkey bound to your device (WebAuthn).'
                : 'Authenticate using an existing passkey.'}
          </p>
        </header>

        <label style={{ display: 'block', marginBottom: 16, color: '#0f172a' }}>
          <div style={{ marginBottom: 6, fontSize: 14, fontWeight: 500 }}>Email (used as userId)</div>
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChangeAction(e.target.value.trim())}
            placeholder="you@example.com"
            autoComplete="username"
            style={{
              width: '100%',
              padding: '11px 14px',
              borderRadius: 8,
              border: '1px solid #cfe4ff',
              background: '#fff',
              outline: 'none',
              fontSize: 14,
            }}
            disabled={loading}
          />
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={primaryAction}
            disabled={loading || (mode === 'register' && !onRegisterAction)}
            style={{
              padding: '12px 16px',
              background: mode === 'register' ? '#6366f1' : '#0ea5e9',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: 0.3,
              boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.08)',
              transition: 'background .15s',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Please wait…' : primaryLabel}
          </button>

            {onRegisterAction && (
              <button
                type="button"
                disabled={loading}
                onClick={() => setMode(mode === 'register' ? 'signin' : 'register')}
                style={{
                  padding: '10px 14px',
                  background: '#eef6ff',
                  color: '#0f172a',
                  border: '1px solid #cfe4ff',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: 13,
                }}
              >
                {switchLabel}
              </button>
            )}
        </div>

        <section style={{ marginTop: 18, fontSize: 12, lineHeight: 1.5, color: '#1e293b' }}>
          {mode === 'register' ? (
            <>
              <strong style={{ color: '#0f172a' }}>Registration flow:</strong> We generate options & challenge → your browser creates a credential → we verify attestation → passkey is stored. We DO NOT sign you in automatically here; use the sign‑in mode after registering.
            </>
          ) : (
            <>
              <strong style={{ color: '#0f172a' }}>Sign-in flow:</strong> We fetch your registered credential IDs → browser performs an assertion → we verify challenge + signature → session established if token exchange succeeds.
            </>
          )}
        </section>

        {message && (
          <div
            style={{
              marginTop: 16,
              padding: '10px 12px',
              borderRadius: 8,
              fontSize: 13,
              background: message.toLowerCase().includes('error') || message.toLowerCase().includes('fail') ? '#fee2e2' : '#ecfdf5',
              color: message.toLowerCase().includes('error') || message.toLowerCase().includes('fail') ? '#b91c1c' : '#065f46',
              border: '1px solid ' + (message.toLowerCase().includes('error') || message.toLowerCase().includes('fail') ? '#fecaca' : '#a7f3d0'),
              whiteSpace: 'pre-wrap',
            }}
          >
            {message}
          </div>
        )}
      </div>
    </main>
  );
}
