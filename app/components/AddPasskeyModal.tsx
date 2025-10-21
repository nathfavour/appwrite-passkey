'use client';

import { useState } from 'react';
import { addPasskeyToAccount } from '@/lib/passkey-client-utils';

interface AddPasskeyModalProps {
  isOpen: boolean;
  email: string;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export default function AddPasskeyModal({
  isOpen,
  email,
  onClose,
  onSuccess,
}: AddPasskeyModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleAddPasskey = async () => {
    setLoading(true);
    setError(null);
    try {
      await addPasskeyToAccount(email);
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Add Passkey</h2>
          <p className="text-slate-600 mt-2">
            Register a new passkey to your account for easier authentication.
          </p>
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Success!</h3>
            <p className="text-slate-600 mt-2">Passkey added successfully</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {error}
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>What happens next?</strong> You&apos;ll be prompted to use your device&apos;s
                authentication method (Face ID, fingerprint, or security key) to create a new
                passkey.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 text-slate-700 hover:bg-slate-100 font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPasskey}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Passkey'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
