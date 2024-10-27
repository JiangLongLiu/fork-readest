'use client';

import * as React from 'react';
import { useEffect, Suspense, useRef } from 'react';

import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';

import ReaderContent from './components/ReaderContent';
import { DEFAULT_READSETTINGS } from '@/services/constants';

const ReaderPage = () => {
  const { envConfig } = useEnv();
  const { settings, setLibrary, setSettings } = useReaderStore();
  const isInitiating = useRef(false);

  useEffect(() => {
    if (isInitiating.current) return;
    isInitiating.current = true;
    const initLibrary = async () => {
      const appService = await envConfig.getAppService();
      const settings = await appService.loadSettings();
      if (!settings.globalReadSettings) {
        settings.globalReadSettings = DEFAULT_READSETTINGS;
      }
      setSettings(settings);
      console.log('initializing library in reader');
      setLibrary(await appService.loadLibraryBooks());
    };

    initLibrary();
  }, []);

  return (
    settings.globalReadSettings && (
      <div className='min-h-screen select-none'>
        <Suspense>
          <ReaderContent />
        </Suspense>
      </div>
    )
  );
};

export default ReaderPage;
