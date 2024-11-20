'use client';

import * as React from 'react';
import { useState, useRef } from 'react';

import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';

import Spinner from '@/components/Spinner';
import LibraryHeader from '@/app/library/components/LibraryHeader';
import Bookshelf from '@/app/library/components/Bookshelf';

const LibraryPage = () => {
  const { envConfig, appService } = useEnv();
  const { library: libraryBooks, setLibrary } = useReaderStore();
  const [loading, setLoading] = useState(true);
  const isInitiating = useRef(false);
  const [isSelectMode, setIsSelectMode] = useState(false);

  React.useEffect(() => {
    if (isInitiating.current) return;
    isInitiating.current = true;
    setLoading(true);
    envConfig.getAppService().then(async (appService) => {
      console.log('Loading library books...');
      setLibrary(await appService.loadLibraryBooks());
      setLoading(false);
    });
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
    return <Spinner loading />;
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
      <div className='mt-12 flex-grow overflow-auto px-2'>
        {libraryBooks.length > 0 ? (
          <Bookshelf
            libraryBooks={libraryBooks}
            isSelectMode={isSelectMode}
            onImportBooks={handleImportBooks}
          />
        ) : (
          <div className='hero h-full items-center justify-center'>
            <div className='hero-content text-neutral-content text-center'>
              <div className='max-w-md'>
                <h1 className='mb-5 text-5xl font-bold'>Your Library</h1>
                <p className='mb-5'>
                  Welcome to your library. You can upload your books here and read them anytime.
                </p>
                <button className='btn btn-primary' onClick={handleImportBooks}>
                  Upload Books
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryPage;
