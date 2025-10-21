'use client';

import { useEffect, useState } from 'react';
import { account } from '@/lib/appwrite';
import { useRouter } from 'next/navigation';
import Navigation from '@/app/components/Navigation';
import Link from 'next/link';

interface UserData {
  email: string;
  name: string;
  userId: string;
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    async function check() {
      try {
        const userData = await account.get();
        if (mounted) {
          setUser({
            email: userData.email,
            name: userData.name || userData.email.split('@')[0],
            userId: userData.$id,
          });
          setLoading(false);
        }
      } catch {
        router.replace('/login');
      }
    }
    check();
    return () => { mounted = false; };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4 animate-pulse">
            <span className="text-2xl">🔐</span>
          </div>
          <p className="text-slate-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Navigation userEmail={user.email} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
            Welcome, {user.name}
          </h1>
          <p className="text-xl text-slate-600">
            Explore the power of passkey authentication with Appwrite
          </p>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow-md p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">User ID</p>
                <p className="text-slate-900 font-semibold text-lg mt-1 break-all">
                  {user.userId.substring(0, 8)}...
                </p>
              </div>
              <span className="text-3xl">👤</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">Email</p>
                <p className="text-slate-900 font-semibold text-lg mt-1 break-all">
                  {user.email}
                </p>
              </div>
              <span className="text-3xl">📧</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">Status</p>
                <p className="text-slate-900 font-semibold text-lg mt-1">Authenticated</p>
              </div>
              <span className="text-3xl">✓</span>
            </div>
          </div>
        </div>

        {/* Feature Highlight */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-8 mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Passkey Management</h2>
          <p className="text-slate-600 mb-6">
            Manage your passkeys in the settings. You can add new passkeys, rename them, and remove
            old ones. Each passkey is a cryptographic credential that authenticates you without a
            password.
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            Go to Settings →
          </Link>
        </div>

        {/* API Info Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">📡 Authentication APIs</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>/api/webauthn/register/options - Get registration challenge</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>/api/webauthn/register/verify - Verify attestation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>/api/webauthn/auth/options - Get authentication challenge</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span>/api/webauthn/auth/verify - Verify assertion</span>
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">🔑 Passkey Management APIs</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 font-bold">•</span>
                <span>/api/webauthn/passkeys/list - List user passkeys</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 font-bold">•</span>
                <span>/api/webauthn/passkeys/rename - Rename passkey</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 font-bold">•</span>
                <span>/api/webauthn/passkeys/delete - Delete passkey</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600 font-bold">•</span>
                <span>/api/webauthn/passkeys/disable - Disable passkey</span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
