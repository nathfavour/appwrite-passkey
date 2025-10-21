'use client';

import { useEffect, useState } from 'react';
import { account } from '@/lib/appwrite';
import { useRouter } from 'next/navigation';
import Navigation from '@/app/components/Navigation';
import PasskeyList from '@/app/components/PasskeyList';
import AddPasskeyModal from '@/app/components/AddPasskeyModal';
import RenamePasskeyModal from '@/app/components/RenamePasskeyModal';
import { listPasskeys } from '@/lib/passkey-client-utils';

interface UserData {
  email: string;
  name: string;
  userId: string;
}

interface Passkey {
  id: string;
  name: string;
  createdAt: number;
  lastUsedAt: number | null;
  status: 'active' | 'disabled' | 'compromised';
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [loadingPasskeys, setLoadingPasskeys] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [selectedPasskey, setSelectedPasskey] = useState<Passkey | null>(null);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    async function initializeSettings() {
      try {
        const userData = await account.get();
        if (mounted) {
          setUser({
            email: userData.email,
            name: userData.name || userData.email.split('@')[0],
            userId: userData.$id,
          });
          await loadPasskeys(userData.email);
          setLoading(false);
        }
      } catch {
        router.replace('/login');
      }
    }
    initializeSettings();
    return () => { mounted = false; };
  }, [router]);

  const loadPasskeys = async (email: string) => {
    setLoadingPasskeys(true);
    setError(null);
    try {
      const data = await listPasskeys(email);
      setPasskeys(data);
    } catch (err) {
      setError((err as Error).message);
      setPasskeys([]);
    } finally {
      setLoadingPasskeys(false);
    }
  };

  const handleAddPasskeySuccess = async () => {
    if (user) {
      await loadPasskeys(user.email);
    }
  };

  const handleRenameClick = (passkey: Passkey) => {
    setSelectedPasskey(passkey);
    setRenameModalOpen(true);
  };

  const handleRenameSuccess = async () => {
    if (user) {
      await loadPasskeys(user.email);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4 animate-pulse">
            <span className="text-2xl">⚙️</span>
          </div>
          <p className="text-slate-600 font-medium">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Navigation userEmail={user.email} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Settings</h1>
          <p className="text-slate-600">Manage your account and passkeys</p>
        </div>

        {/* Account Section */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-8 mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Account Information</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Email</label>
              <p className="text-lg text-slate-900 font-semibold">{user.email}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">User ID</label>
              <p className="text-sm font-mono text-slate-600 break-all bg-slate-50 p-3 rounded border border-slate-200">
                {user.userId}
              </p>
            </div>
          </div>
        </div>

        {/* Passkey Management Section */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Passkey Management</h2>
              <p className="text-slate-600 mt-2">
                Add, rename, or delete passkeys to manage your authentication methods
              </p>
            </div>
            <button
              onClick={() => setAddModalOpen(true)}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg whitespace-nowrap"
            >
              + Add Passkey
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          {loadingPasskeys ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3 animate-pulse">
                <span className="text-xl">🔑</span>
              </div>
              <p className="text-slate-600">Loading your passkeys...</p>
            </div>
          ) : (
            <PasskeyList
              passkeys={passkeys}
              email={user.email}
              onUpdate={() => loadPasskeys(user.email)}
              onRenameClick={handleRenameClick}
            />
          )}
        </div>

        {/* API Reference Section */}
        <div className="mt-8 bg-slate-800 rounded-lg shadow-md p-8 text-white">
          <h3 className="text-lg font-bold mb-4">🔌 API Endpoints Used</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold mb-2">On this page:</p>
              <ul className="space-y-1 text-slate-300">
                <li>✓ GET /api/webauthn/passkeys/list</li>
                <li>✓ POST /api/webauthn/passkeys/rename</li>
                <li>✓ POST /api/webauthn/passkeys/delete</li>
                <li>✓ POST /api/webauthn/passkeys/disable</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-2">When adding passkey:</p>
              <ul className="space-y-1 text-slate-300">
                <li>✓ POST /api/webauthn/connect/options</li>
                <li>✓ POST /api/webauthn/connect/verify</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      <AddPasskeyModal
        isOpen={addModalOpen}
        email={user.email}
        onClose={() => setAddModalOpen(false)}
        onSuccess={handleAddPasskeySuccess}
      />

      <RenamePasskeyModal
        isOpen={renameModalOpen}
        passkey={selectedPasskey}
        email={user.email}
        onClose={() => {
          setRenameModalOpen(false);
          setSelectedPasskey(null);
        }}
        onSuccess={handleRenameSuccess}
      />
    </div>
  );
}
