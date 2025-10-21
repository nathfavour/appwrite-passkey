'use client';

import { useEffect, useState } from 'react';
import { account } from '@/lib/appwrite';
import { useRouter } from 'next/navigation';
import Navigation from '@/app/components/Navigation';
import Link from 'next/link';
import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Stack,
} from '@mui/material';

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
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)',
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={60} sx={{ color: '#2563eb' }} />
          <Typography sx={{ mt: 2, color: '#64748b' }}>Loading...</Typography>
        </Box>
      </Box>
    );
  }

  if (!user) return null;

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)' }}>
      <Navigation userEmail={user.email} />

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(90deg, #2563eb 0%, #4f46e5 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1,
            }}
          >
            Welcome, {user.name}
          </Typography>
          <Typography variant="h6" sx={{ color: '#64748b' }}>
            Explore the power of passkey authentication with Appwrite
          </Typography>
        </Box>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ height: '100%', boxShadow: 1 }}>
              <CardContent>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
                  <Box sx={{ fontSize: 24 }}>👤</Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      User ID
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-all', mt: 0.5 }}>
                      {user.userId.substring(0, 8)}...
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ height: '100%', boxShadow: 1 }}>
              <CardContent>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
                  <Box sx={{ fontSize: 24 }}>📧</Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      Email
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-all', mt: 0.5 }}>
                      {user.email}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ height: '100%', boxShadow: 1 }}>
              <CardContent>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
                  <Box sx={{ fontSize: 24 }}>✓</Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      Status
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                      Authenticated
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Card sx={{ mb: 4, boxShadow: 1 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
              Passkey Management
            </Typography>
            <Typography sx={{ color: '#64748b', mb: 3 }}>
              Manage your passkeys in the settings. You can add new passkeys, rename them, and remove old ones. Each passkey is a cryptographic credential that authenticates you without a password.
            </Typography>
            <Link href="/settings" style={{ textDecoration: 'none' }}>
              <Button
                variant="contained"
                sx={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                  textTransform: 'none',
                  fontWeight: 600,
                  '&:hover': {
                    background: 'linear-gradient(135deg, #1d4ed8 0%, #4338ca 100%)',
                  },
                }}
              >
                Go to Settings →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={{ boxShadow: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  📡 Authentication APIs
                </Typography>
                <Stack spacing={1}>
                  {[
                    '/api/webauthn/register/options - Get registration challenge',
                    '/api/webauthn/register/verify - Verify attestation',
                    '/api/webauthn/auth/options - Get authentication challenge',
                    '/api/webauthn/auth/verify - Verify assertion',
                  ].map((item, idx) => (
                    <Typography key={idx} variant="body2" sx={{ color: '#64748b', display: 'flex', gap: 1 }}>
                      <span style={{ color: '#2563eb', fontWeight: 'bold' }}>•</span>
                      {item}
                    </Typography>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ boxShadow: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  🔑 Passkey Management APIs
                </Typography>
                <Stack spacing={1}>
                  {[
                    '/api/webauthn/passkeys/list - List user passkeys',
                    '/api/webauthn/passkeys/rename - Rename passkey',
                    '/api/webauthn/passkeys/delete - Delete passkey',
                    '/api/webauthn/passkeys/disable - Disable passkey',
                  ].map((item, idx) => (
                    <Typography key={idx} variant="body2" sx={{ color: '#64748b', display: 'flex', gap: 1 }}>
                      <span style={{ color: '#4f46e5', fontWeight: 'bold' }}>•</span>
                      {item}
                    </Typography>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
