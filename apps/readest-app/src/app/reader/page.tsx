'use client';

import { useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { isTauriAppPlatform } from '@/services/environment';
import { checkForAppUpdates } from '@/helpers/updater';
import Reader from './components/Reader';

export default function Page() {
  useTheme();
  useEffect(() => {
    const doAppUpdates = async () => {
      if (isTauriAppPlatform()) {
        await checkForAppUpdates();
      }
    };
    doAppUpdates();
  }, []);

  return <Reader />;
}
