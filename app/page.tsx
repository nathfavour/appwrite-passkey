"use client";

import { useEffect, useState } from 'react';
import { account } from '../lib/appwrite';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    async function check() {
      try {
        await account.get();
        if (mounted) setLoading(false);
      } catch (err) {
        router.replace('/login');
      }
    }
    check();
    return () => { mounted = false; };
  }, [router]);

  if (loading) return <div style={{padding: 24}}>Loading...</div>;

  return (
    <main style={{padding: 24}}>
      <h1>Home</h1>
      <p>You are signed in.</p>
    </main>
  );
}
