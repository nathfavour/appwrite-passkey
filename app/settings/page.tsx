'use client';

import { useEffect, useState } from 'react';
import { account } from '@/lib/appwrite';
import { useRouter } from 'next/navigation';
import Navigation from '@/app/components/Navigation';
import PasskeyList from '@/app/components/PasskeyList';
import AddPasskeyModal from '@/app/components/AddPasskeyModal';
import RenamePasskeyModal from '@/app/components/RenamePasskeyModal';
import { listPasskeys } from '@/lib/passkey-client-utils';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Stack,
  Grid,
  Alert,
  AlertTitle,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

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
          <Typography sx={{ mt: 2, color: '#64748b' }}>Loading settings...</Typography>
        </Box>
      </Box>
    );
  }

  if (!user) return null;

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)' }}>
      <Navigation userEmail={user.email} />

      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Settings
          </Typography>
          <Typography sx={{ color: '#64748b' }}>Manage your account and passkeys</Typography>
        </Box>

        {/* Account Section */}
        <Card sx={{ mb: 4, boxShadow: 1 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
              Account Information
            </Typography>

            <Stack spacing={3}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#64748b', mb: 1 }}>
                  Email
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {user.email}
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#64748b', mb: 1 }}>
                  User ID
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'monospace',
                    color: '#64748b',
                    backgroundColor: '#f1f5f9',
                    p: 1.5,
                    borderRadius: 1,
                    wordBreak: 'break-all',
                  }}
                >
                  {user.userId}
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* Passkey Management Section */}
        <Card sx={{ boxShadow: 1 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Passkey Management
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mt: 1 }}>
                  Add, rename, or delete passkeys to manage your authentication methods
                </Typography>
              </Box>
              <Button
                onClick={() => setAddModalOpen(true)}
                variant="contained"
                startIcon={<AddIcon />}
                sx={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                  textTransform: 'none',
                  fontWeight: 600,
                  '&:hover': {
                    background: 'linear-gradient(135deg, #1d4ed8 0%, #4338ca 100%)',
                  },
                }}
              >
                Add Passkey
              </Button>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <AlertTitle>Error</AlertTitle>
                {error}
              </Alert>
            )}

            {loadingPasskeys ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={40} sx={{ color: '#2563eb' }} />
                <Typography sx={{ mt: 2, color: '#64748b' }}>Loading your passkeys...</Typography>
              </Box>
            ) : (
              <PasskeyList
                passkeys={passkeys}
                email={user.email}
                onUpdate={() => loadPasskeys(user.email)}
                onRenameClick={handleRenameClick}
              />
            )}
          </CardContent>
        </Card>

        {/* API Reference Section */}
        <Card sx={{ mt: 4, backgroundColor: '#1e293b', color: 'white', boxShadow: 1 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              🔌 API Endpoints Used
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    On this page:
                  </Typography>
                  <Stack spacing={0.5}>
                    {[
                      'GET /api/webauthn/passkeys/list',
                      'POST /api/webauthn/passkeys/rename',
                      'POST /api/webauthn/passkeys/delete',
                      'POST /api/webauthn/passkeys/disable',
                    ].map((endpoint, idx) => (
                      <Typography key={idx} variant="body2" sx={{ color: '#e2e8f0' }}>
                        ✓ {endpoint}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    When adding passkey:
                  </Typography>
                  <Stack spacing={0.5}>
                    {[
                      'POST /api/webauthn/connect/options',
                      'POST /api/webauthn/connect/verify',
                    ].map((endpoint, idx) => (
                      <Typography key={idx} variant="body2" sx={{ color: '#e2e8f0' }}>
                        ✓ {endpoint}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Container>

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
    </Box>
  );
}
