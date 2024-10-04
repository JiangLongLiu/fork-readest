'use client';

import * as React from 'react';
import { useState } from 'react';

import { Book } from '@/types/book';
import { useEnv } from '@/context/EnvContext';

import Navbar from '@/components/Navbar';
import Spinner from '@/components/Spinner';
import Bookshelf from '@/components/Bookshelf';

type AppState = 'Init' | 'Loading' | 'Library' | 'Reader';

const LibraryPage = () => {
  const { envConfig } = useEnv();
  const [appState, setAppState] = useState<AppState>('Init');
  const [libraryBooks, setLibraryBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  React.useEffect(() => {
    if (appState !== 'Init') return;
    setAppState('Loading');
    setLoading(true);
    envConfig.appService().then((appService) => {
      appService.loadSettings().then((settings) => {
        console.log('Settings', settings);
        appService
          .loadLibraryBooks()
          .then((libraryBooks) => {
            setLibraryBooks(libraryBooks);
            setAppState('Library');
            setLoading(false);
          })
          .catch((err) => {
            console.error(err);
            setLoading(false);
            appService.showMessage(`Failed to load library books: ${err}`, 'error');
          });
      });
    });
  }, [envConfig, appState]);

  const handleImport = () => {
    // logic to import books
    console.log('Importing books...');
  };

  return (
    <div className='min-h-screen bg-gray-100'>
      <Navbar onImport={handleImport} />
      <div className='min-h-screen p-2 pt-16'>
        <div className='hero-content'>
          <Spinner loading={loading} />
          <Bookshelf libraryBooks={libraryBooks} onImport={handleImport} />
        </div>
      </div>
    </div>
  );
};

export default LibraryPage;
