'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/context/AuthContext';
import { EnvProvider } from '@/context/EnvContext';
import { CSPostHogProvider } from '@/context/PHContext';
import { useTheme } from '@/hooks/useTheme';
import '../styles/globals.css';
import '../styles/fonts.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useTheme();
  const pathname = usePathname();
  React.useEffect(() => {
    document.documentElement.setAttribute('data-page', pathname.replace('/', '') || 'default');
  }, [pathname]);

  React.useEffect(() => {
    // TODO: disabled for now
    // if (process.env['NODE_ENV'] === 'production') {
    //   document.oncontextmenu = (event) => {
    //     event.preventDefault();
    //   };
    // }
  }, []);

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
