'use client';

import * as React from 'react';
import { useEffect, Suspense } from 'react';

import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';

import ReaderContent from './components/ReaderContent';
import { DEFAULT_READSETTINGS } from '@/services/constants';

const ReaderPage = () => {
  const { envConfig } = useEnv();
  const { settings, setLibrary, setSettings } = useReaderStore();

  useEffect(() => {
    const initLibrary = async () => {
      const appService = await envConfig.getAppService();
      const settings = await appService.loadSettings();
      if (!settings.globalReadSettings) {
        settings.globalReadSettings = DEFAULT_READSETTINGS;
      }
      setSettings(settings);
      setLibrary(await appService.loadLibraryBooks());
    };

    initLibrary();
  }, [envConfig, setLibrary]);

  return (
    settings.globalReadSettings && (
      <div className='min-h-screen bg-gray-100'>
        <Suspense>
          <ReaderContent />
        </Suspense>
      </div>
    )
  );
};

export default ReaderPage;
