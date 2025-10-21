'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Stack,
  Alert,
} from '@mui/material';
import { addPasskeyToAccount } from '@/lib/passkey-client-utils';

interface AddPasskeyModalProps {
  isOpen: boolean;
  email: string;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export default function AddPasskeyModal({
  isOpen,
  email,
  onClose,
  onSuccess,
}: AddPasskeyModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleAddPasskey = async () => {
    setLoading(true);
    setError(null);
    try {
      await addPasskeyToAccount(email);
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Add Passkey</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {success ? (
          <Stack sx={{ textAlign: 'center', py: 3 }} spacing={2}>
            <Box sx={{ fontSize: 32 }}>✓</Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Success!
            </Typography>
            <Typography sx={{ color: '#64748b' }}>Passkey added successfully</Typography>
          </Stack>
        ) : (
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}

            <Typography sx={{ color: '#64748b' }}>
              Register a new passkey to your account for easier authentication.
            </Typography>

            <Alert severity="info">
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                What happens next?
              </Typography>
              <Typography variant="body2">
                You&apos;ll be prompted to use your device&apos;s authentication method (Face ID, fingerprint,
                or security key) to create a new passkey.
              </Typography>
            </Alert>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        {!success && (
          <>
            <Button onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleAddPasskey}
              disabled={loading}
              variant="contained"
              sx={{
                background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #1d4ed8 0%, #4338ca 100%)',
                },
              }}
            >
              {loading ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Adding...
                </>
              ) : (
                'Add Passkey'
              )}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
