import { AppProps } from 'next/app';
import Providers from '@/components/Providers';

import '../styles/globals.css';
import '../styles/fonts.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <Providers>
      <Component {...pageProps} />
    </Providers>
  );
}

export default MyApp;
