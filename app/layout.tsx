import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Appwrite Passkey Demo',
  description: 'Sophisticated passkey authentication and management demonstration',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
