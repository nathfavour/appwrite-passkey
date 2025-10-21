'use client';

import { useState } from 'react';
import { renamePasskey } from '@/lib/passkey-client-utils';

interface Passkey {
  id: string;
  name: string;
  createdAt: number;
  lastUsedAt: number | null;
  status: 'active' | 'disabled' | 'compromised';
}

interface RenamePasskeyModalProps {
  isOpen: boolean;
  passkey: Passkey | null;
  email: string;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export default function RenamePasskeyModal({
  isOpen,
  passkey,
  email,
  onClose,
  onSuccess,
}: RenamePasskeyModalProps) {
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !passkey) return null;

  const handleRename = async () => {
    if (!newName.trim()) {
      setError('Please enter a name');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await renamePasskey(email, passkey.id, newName.trim());
      await onSuccess();
      setNewName('');
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNewName('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Rename Passkey</h2>
          <p className="text-slate-600 mt-2">Give your passkey a memorable name</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-900">
            Passkey Name
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={passkey.name}
            maxLength={50}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
          <p className="text-xs text-slate-500">
            {newName.length}/50 characters
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-4 py-2 text-slate-700 hover:bg-slate-100 font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleRename}
            disabled={loading || !newName.trim()}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50"
          >
            {loading ? 'Renaming...' : 'Rename'}
          </button>
        </div>
      </div>
    </div>
  );
}
