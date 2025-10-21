'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/passkey-client-utils';

interface NavProps {
  userEmail?: string;
}

export default function Navigation({ userEmail }: NavProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">🔐</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Passkey Demo
            </span>
          </Link>

          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-slate-600 hover:text-blue-600 transition-colors font-medium"
            >
              Home
            </Link>
            <Link
              href="/settings"
              className="text-slate-600 hover:text-blue-600 transition-colors font-medium"
            >
              Settings
            </Link>

            <div className="border-l border-slate-200 pl-6">
              {userEmail && (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm text-slate-600">Signed in as</p>
                    <p className="text-sm font-medium text-slate-900">{userEmail}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
