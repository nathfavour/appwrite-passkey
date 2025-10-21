'use client';

import React, { useState } from 'react';

type Props = {
  email: string;
  onEmailChangeAction: (value: string) => void;
  onPasskeyAction: () => Promise<void> | void;
  onRegisterAction?: () => Promise<void> | void;
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

  const isError = message?.toLowerCase().includes('error') || message?.toLowerCase().includes('fail');

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {singleMode ? 'Passkey Authentication' : mode === 'register' ? 'Register Passkey' : 'Sign In'}
          </h1>
          <p className="text-slate-600 text-sm">
            {singleMode
              ? 'Continue with your device passkey'
              : mode === 'register'
                ? 'Create a passkey bound to your device'
                : 'Authenticate with an existing passkey'}
          </p>
        </div>

        {/* Email Input */}
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-2">
            Email (User ID)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChangeAction(e.target.value.trim())}
            placeholder="you@example.com"
            autoComplete="username"
            disabled={loading}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500 transition-colors"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={primaryAction}
            disabled={loading || (mode === 'register' && !onRegisterAction)}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {loading ? 'Please wait…' : primaryLabel}
          </button>

          {onRegisterAction && (
            <button
              type="button"
              disabled={loading}
              onClick={() => setMode(mode === 'register' ? 'signin' : 'register')}
              className="w-full px-4 py-2 border border-slate-300 text-slate-900 font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {switchLabel}
            </button>
          )}
        </div>

        {/* Info Text */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-slate-700">
          <strong className="text-slate-900">How it works:</strong>
          <div className="mt-2 text-xs text-slate-600">
            {mode === 'register' ? (
              <p>Your browser will generate a cryptographic credential stored securely on your device. This credential is used for future authentication.</p>
            ) : (
              <p>Your device will verify ownership of your passkey through biometric or PIN authentication, creating a signed challenge response.</p>
            )}
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div
            className={`p-4 rounded-lg text-sm ${
              isError
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-green-50 border border-green-200 text-green-800'
            }`}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
