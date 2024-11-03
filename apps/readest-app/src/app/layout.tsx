import * as React from 'react';
import type { Metadata } from 'next';
import { AuthProvider } from '@/context/AuthContext';
import { EnvProvider } from '@/context/EnvContext';
import { CSPostHogProvider } from '@/context/PHContext';
import './globals.css';
import './fonts.css';

export const metadata: Metadata = {
  title: 'Readest',
  description: 'read to learn',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <head>
        <meta name='viewport' content='width=device-width, initial-scale=1, maximum-scale=1' />
      </head>
      <CSPostHogProvider>
        <body>
          <EnvProvider>
            <AuthProvider>{children}</AuthProvider>
          </EnvProvider>
        </body>
      </CSPostHogProvider>
    </html>
  );
}
