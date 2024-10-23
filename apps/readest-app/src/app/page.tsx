'use client';

import * as React from 'react';
import { useState, useRef } from 'react';

import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';

import SearchBar from '@/components/SearchBar';
import Spinner from '@/components/Spinner';
import Bookshelf from '@/components/Bookshelf';

const LibraryPage = () => {
  const { envConfig, appService, getAppService } = useEnv();
  const { library: libraryBooks, setLibrary } = useReaderStore();
  const [loading, setLoading] = useState(true);
  const isInitiating = useRef(false);

  React.useEffect(() => {
    if (isInitiating.current) return;
    isInitiating.current = true;
    setLoading(true);
    getAppService(envConfig).then(async (appService) => {
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

  return (
    <div className='min-h-screen bg-gray-100'>
      <SearchBar onImportBooks={handleImportBooks} />
      <div className='min-h-screen p-2 pt-16'>
        <div className='hero-content'>
          <Spinner loading={loading} />
          <Bookshelf libraryBooks={libraryBooks} onImportBooks={handleImportBooks} />
        </div>
        {!loading && libraryBooks.length === 0 && (
          <div className='hero min-h-screen'>
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
