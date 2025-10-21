import type { Metadata } from 'next';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

export const metadata: Metadata = {
  title: 'Appwrite Passkey Demo',
  description: 'Sophisticated passkey authentication and management demonstration',
};

const theme = createTheme({
  palette: {
    primary: {
      main: '#2563eb', // Blue
    },
    secondary: {
      main: '#4f46e5', // Indigo
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: 'Inter, "Roboto", "Helvetica", "Arial", sans-serif',
  },
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
