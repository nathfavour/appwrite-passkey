'use client';

import { useState } from 'react';
import {
  Box,
  Stack,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  IconButton,
  AlertTitle,
  Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import DisabledByDefaultIcon from '@mui/icons-material/DisabledByDefault';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { deletePasskey, disablePasskey, enablePasskey } from '@/lib/passkey-client-utils';

interface Passkey {
  id: string;
  name: string;
  createdAt: number;
  lastUsedAt: number | null;
  status: 'active' | 'disabled' | 'compromised';
}

interface PasskeyListProps {
  passkeys: Passkey[];
  email: string;
  onUpdate: () => Promise<void>;
  onRenameClick: (passkey: Passkey) => void;
}

export default function PasskeyList({
  passkeys,
  email,
  onUpdate,
  onRenameClick,
}: PasskeyListProps) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [disabling, setDisabling] = useState<string | null>(null);
  const [enabling, setEnabling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (credentialId: string) => {
    if (!confirm('Are you sure you want to delete this passkey? This action cannot be undone.')) {
      return;
    }

    setDeleting(credentialId);
    setError(null);
    try {
      await deletePasskey(email, credentialId);
      await onUpdate();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(null);
    }
  };

  const handleDisable = async (credentialId: string) => {
    setDisabling(credentialId);
    setError(null);
    try {
      await disablePasskey(email, credentialId);
      await onUpdate();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDisabling(null);
    }
  };

  const handleEnable = async (credentialId: string) => {
    setEnabling(credentialId);
    setError(null);
    try {
      await enablePasskey(email, credentialId);
      await onUpdate();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnabling(null);
    }
  };

  if (passkeys.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Box sx={{ fontSize: 48, mb: 2 }}>🔑</Box>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          No Passkeys Yet
        </Typography>
        <Typography sx={{ color: '#64748b' }}>Add your first passkey to get started</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {error && (
        <Alert severity="error">
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      )}

      <Stack spacing={2}>
        {passkeys.map((passkey) => (
          <Card key={passkey.id} sx={{ boxShadow: 1 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <Typography sx={{ fontSize: 18 }}>🔑</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {passkey.name}
                    </Typography>
                    <Chip
                      label={passkey.status}
                      size="small"
                      color={
                        passkey.status === 'active'
                          ? 'success'
                          : passkey.status === 'disabled'
                            ? 'warning'
                            : 'error'
                      }
                      variant="outlined"
                    />
                  </Box>
                  <Stack spacing={0.5}>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      Created: {new Date(passkey.createdAt).toLocaleDateString()}
                    </Typography>
                    {passkey.lastUsedAt && (
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        Last used: {new Date(passkey.lastUsedAt).toLocaleDateString()}
                      </Typography>
                    )}
                  </Stack>
                </Box>

                <Stack direction="row" spacing={1}>
                  <IconButton
                    size="small"
                    onClick={() => onRenameClick(passkey)}
                    title="Rename"
                    sx={{ color: '#2563eb' }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  {passkey.status === 'active' && (
                    <IconButton
                      size="small"
                      onClick={() => handleDisable(passkey.id)}
                      disabled={disabling === passkey.id}
                      title="Disable"
                      sx={{ color: '#f59e0b' }}
                    >
                      <DisabledByDefaultIcon fontSize="small" />
                    </IconButton>
                  )}
                  {passkey.status === 'disabled' && (
                    <IconButton
                      size="small"
                      onClick={() => handleEnable(passkey.id)}
                      disabled={enabling === passkey.id}
                      title="Enable"
                      sx={{ color: '#10b981' }}
                    >
                      <CheckCircleIcon fontSize="small" />
                    </IconButton>
                  )}
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(passkey.id)}
                    disabled={deleting === passkey.id}
                    title="Delete"
                    sx={{ color: '#ef4444' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
