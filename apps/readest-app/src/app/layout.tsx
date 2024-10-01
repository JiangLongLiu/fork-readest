import type { Metadata } from 'next';
import { AuthProvider } from '../context/AuthContext';
import { EnvProvider } from '../context/EnvContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'Readest',
  description: 'read to learn',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <head>
        <meta
          name='viewport'
          content='width=device-width, height=device-height, initial-scale=1.0'
        />
      </head>
      <body>
        <EnvProvider>
          <AuthProvider>{children}</AuthProvider>
        </EnvProvider>
      </body>
    </html>
  );
}
