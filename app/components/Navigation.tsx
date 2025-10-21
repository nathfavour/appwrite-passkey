'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  Stack,
  Divider,
} from '@mui/material';
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
    <AppBar position="sticky" sx={{ boxShadow: 1 }}>
      <Toolbar sx={{ maxWidth: '7xl', width: '100%', margin: '0 auto' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>🔐</span>
          </Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(90deg, #2563eb 0%, #4f46e5 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Passkey Demo
          </Typography>
        </Link>

        <Box sx={{ flexGrow: 1 }} />

        <Stack direction="row" spacing={3} sx={{ display: 'flex', alignItems: 'center' }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Typography
              sx={{
                color: 'white',
                cursor: 'pointer',
                fontWeight: 500,
                '&:hover': { opacity: 0.8 },
              }}
            >
              Home
            </Typography>
          </Link>
          <Link href="/settings" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Typography
              sx={{
                color: 'white',
                cursor: 'pointer',
                fontWeight: 500,
                '&:hover': { opacity: 0.8 },
              }}
            >
              Settings
            </Typography>
          </Link>

          <Divider orientation="vertical" sx={{ borderColor: 'rgba(255,255,255,0.3)', height: 32 }} />

          {userEmail && (
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Signed in as
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'white' }}>
                  {userEmail}
                </Typography>
              </Box>
              <Button
                onClick={handleSignOut}
                variant="contained"
                sx={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  },
                }}
              >
                Sign Out
              </Button>
            </Stack>
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
