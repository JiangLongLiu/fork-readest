'use client';

import * as React from 'react';
import { useState, useRef } from 'react';

import { useEnv } from '@/context/EnvContext';
import { useLibraryStore } from '@/store/libraryStore';

import Spinner from '@/components/Spinner';
import LibraryHeader from '@/app/library/components/LibraryHeader';
import Bookshelf from '@/app/library/components/Bookshelf';

const LibraryPage = () => {
  const { envConfig, appService } = useEnv();
  const { library: libraryBooks, setLibrary } = useLibraryStore();
  const [loading, setLoading] = useState(false);
  const isInitiating = useRef(false);
  const [isSelectMode, setIsSelectMode] = useState(false);

  React.useEffect(() => {
    if (isInitiating.current) return;
    isInitiating.current = true;

    const loadingTimeout = setTimeout(() => setLoading(true), 200);
    envConfig.getAppService().then(async (appService) => {
      console.log('Loading library books...');
      setLibrary(await appService.loadLibraryBooks());
      if (loadingTimeout) clearTimeout(loadingTimeout);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importBooks = async (files: [string | File]) => {
    setLoading(true);
    for (const file of files) {
      await appService?.importBook(file, libraryBooks);
      setLibrary(libraryBooks);
    }
    appService?.saveLibraryBooks(libraryBooks);
    setLoading(false);
  };

  const selectFilesTauri = async () => {
    return appService?.selectFiles('Select Books', ['epub', 'pdf']);
  };

  const selectFilesWeb = () => {
    return new Promise((resolve) => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.epub, .pdf';
      fileInput.multiple = true;
      fileInput.click();

      fileInput.onchange = () => {
        resolve(fileInput.files);
      };
    });
  };

  const handleImportBooks = async () => {
    console.log('Importing books...');
    const { type } = await import('@tauri-apps/plugin-os');
    let files;
    if (['android', 'ios'].includes(type())) {
      files = (await selectFilesWeb()) as [File];
    } else {
      files = (await selectFilesTauri()) as [string];
    }
    importBooks(files);
  };

  const handleToggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
  };

  if (!appService) {
    return null;
  }

  return (
    <div className='library-page rounded-window bg-base-200/50 text-base-content flex h-full min-h-screen select-none flex-col overflow-hidden'>
      <div className='fixed top-0 z-40 w-full'>
        <LibraryHeader
          isSelectMode={isSelectMode}
          onImportBooks={handleImportBooks}
          onToggleSelectMode={handleToggleSelectMode}
        />
      </div>
      {loading && (
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <Spinner loading />
        </div>
      )}
      {libraryBooks.length > 0 ? (
        <div className='mt-12 flex-grow overflow-auto px-2'>
          <Bookshelf
            libraryBooks={libraryBooks}
            isSelectMode={isSelectMode}
            onImportBooks={handleImportBooks}
          />
        </div>
      ) : (
        <div className='hero h-screen items-center justify-center'>
          <div className='hero-content text-neutral-content text-center'>
            <div className='max-w-md'>
              <h1 className='mb-5 text-5xl font-bold'>Your Library</h1>
              <p className='mb-5'>
                Welcome to your library. You can import your books here and read them anytime.
              </p>
              <button className='btn btn-primary rounded-xl' onClick={handleImportBooks}>
                Import Books
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryPage;
