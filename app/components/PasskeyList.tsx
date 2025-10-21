'use client';

import { useState } from 'react';
import { deletePasskey, disablePasskey } from '@/lib/passkey-client-utils';

interface Passkey {
  id: string;
  name: string;
  createdAt: number;
  lastUsedAt: number | null;
  status: 'active' | 'disabled' | 'compromised';
}

interface PasskeyListProps {
  passkeys: Passkey[];
  email: string;
  onUpdate: () => Promise<void>;
  onRenameClick: (passkey: Passkey) => void;
}

export default function PasskeyList({
  passkeys,
  email,
  onUpdate,
  onRenameClick,
}: PasskeyListProps) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [disabling, setDisabling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (credentialId: string) => {
    if (!confirm('Are you sure you want to delete this passkey? This action cannot be undone.')) {
      return;
    }

    setDeleting(credentialId);
    setError(null);
    try {
      await deletePasskey(email, credentialId);
      await onUpdate();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(null);
    }
  };

  const handleDisable = async (credentialId: string) => {
    setDisabling(credentialId);
    setError(null);
    try {
      await disablePasskey(email, credentialId);
      await onUpdate();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDisabling(null);
    }
  };

  if (passkeys.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <span className="text-2xl">🔑</span>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">No Passkeys Yet</h3>
        <p className="text-slate-600">Add your first passkey to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-3">
        {passkeys.map((passkey) => (
          <div
            key={passkey.id}
            className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-lg">🔑</span>
                <h4 className="font-semibold text-slate-900">{passkey.name}</h4>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    passkey.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : passkey.status === 'disabled'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {passkey.status}
                </span>
              </div>
              <div className="text-sm text-slate-500 space-y-1">
                <p>Created: {new Date(passkey.createdAt).toLocaleDateString()}</p>
                {passkey.lastUsedAt && (
                  <p>Last used: {new Date(passkey.lastUsedAt).toLocaleDateString()}</p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => onRenameClick(passkey)}
                className="px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Rename
              </button>
              {passkey.status === 'active' && (
                <button
                  onClick={() => handleDisable(passkey.id)}
                  disabled={disabling === passkey.id}
                  className="px-3 py-2 text-sm font-medium text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {disabling === passkey.id ? 'Disabling...' : 'Disable'}
                </button>
              )}
              <button
                onClick={() => handleDelete(passkey.id)}
                disabled={deleting === passkey.id}
                className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting === passkey.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
