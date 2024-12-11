import * as React from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { EnvProvider } from '@/context/EnvContext';
import { CSPostHogProvider } from '@/context/PHContext';

import '../styles/globals.css';
import '../styles/fonts.css';

const url = 'https://web.readest.com/';
const title = 'Readest — Where You Read, Digest and Get Insight';
const description = 'Readest brings your entire library to your fingertips.';
const previewImage = 'https://cdn.readest.com/images/open_graph_preview_read_now.png';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <head>
        <title>{title}</title>
        <meta name='mobile-web-app-capable' content='yes' />
        <meta name='apple-mobile-web-app-status-bar-style' content='default' />
        <meta name='viewport' content='width=device-width, initial-scale=1, maximum-scale=1' />
        <link rel='apple-touch-icon' sizes='180x180' href='/apple-touch-icon.png' />
        <link rel='icon' href='/favicon.ico' />
        <meta name='description' content={description} />
        <meta property='og:url' content={url} />
        <meta property='og:type' content='website' />
        <meta property='og:title' content={title} />
        <meta property='og:description' content={description} />
        <meta property='og:image' content={previewImage} />
        <meta name='twitter:card' content='summary_large_image' />
        <meta property='twitter:domain' content='web.readest.com' />
        <meta property='twitter:url' content={url} />
        <meta name='twitter:title' content={title} />
        <meta name='twitter:description' content={description} />
        <meta name='twitter:image' content={previewImage} />
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
