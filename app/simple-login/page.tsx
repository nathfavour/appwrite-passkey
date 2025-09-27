"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SimplePasskeyAuth } from '../../lib/simple-passkeys';

export default function SimpleLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('user@example.com');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  const passkeyAuth = new SimplePasskeyAuth();

  // Check if user is already logged in
  React.useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const currentUser = await passkeyAuth.getCurrentUser();
    setUser(currentUser);
  }

  async function registerPasskey() {
    setMessage(null);
    setLoading(true);
    
    try {
      const result = await passkeyAuth.register(email);
      
      if (result.success) {
        setMessage('Registration successful! Redirecting...');
        await checkUser();
        setTimeout(() => router.replace('/'), 1000);
      } else {
        setMessage(result.error || 'Registration failed');
      }
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function signInWithPasskey() {
    setMessage(null);
    setLoading(true);
    
    try {
      const result = await passkeyAuth.authenticate(email);
      
      if (result.success) {
        setMessage('Sign in successful! Redirecting...');
        await checkUser();
        setTimeout(() => router.replace('/'), 1000);
      } else {
        setMessage(result.error || 'Sign in failed');
      }
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    setLoading(true);
    try {
      await passkeyAuth.signOut();
      setUser(null);
      setMessage('Signed out successfully');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Welcome!</h2>
            <p className="mt-2 text-gray-600">Signed in as: {user.email}</p>
            <p className="text-sm text-gray-500">User ID: {user.$id}</p>
          </div>
          
          <div className="space-y-4">
            <button
              onClick={signOut}
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              {loading ? 'Signing out...' : 'Sign Out'}
            </button>
            
            <button
              onClick={() => router.push('/')}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Passkey Authentication</h2>
          <p className="mt-2 text-gray-600">Sign in or register with your passkey</p>
        </div>

        <div className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your email"
            />
          </div>

          {message && (
            <div className={`p-3 rounded-md ${
              message.includes('successful') || message.includes('success')
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={signInWithPasskey}
              disabled={loading || !email}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In with Passkey'}
            </button>

            <button
              onClick={registerPasskey}
              disabled={loading || !email}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Registering...' : 'Register New Passkey'}
            </button>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            Passkeys provide secure authentication using your device's biometrics or PIN.
          </p>
        </div>
      </div>
    </div>
  );
}