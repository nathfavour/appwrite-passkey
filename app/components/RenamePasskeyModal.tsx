'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Stack,
  Alert,
} from '@mui/material';
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

  if (!passkey) return null;

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
    <Dialog open={isOpen} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Rename Passkey</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2}>
          <Typography sx={{ color: '#64748b' }}>Give your passkey a memorable name</Typography>

          {error && <Alert severity="error">{error}</Alert>}

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Passkey Name
            </Typography>
            <TextField
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={passkey.name}
              maxLength={50}
              disabled={loading}
              fullWidth
              variant="outlined"
              size="small"
            />
            <Typography variant="caption" sx={{ color: '#64748b', mt: 0.5, display: 'block' }}>
              {newName.length}/50 characters
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleRename}
          disabled={loading || !newName.trim()}
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
              Renaming...
            </>
          ) : (
            'Rename'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
