'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Spinner from '@/components/Spinner';
import ReaderContent from '@/components/ReaderContent';
import NavBar from '@/components/NavBar';
import { useReaderStore } from '@/store/readerStore';
import { useEnv } from '@/context/EnvContext';

const ReaderPage = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');

  const [isNavBarVisible, setIsNavBarVisible] = useState(false);
  const { envConfig } = useEnv();
  const { books, fetchBook } = useReaderStore();
  const bookState = books[id!] || { loading: true, content: null, error: null };

  useEffect(() => {
    envConfig.appService().then((appService) => {
      appService
        .loadSettings()
        .then(() => {
          return id && !bookState.content ? fetchBook(appService, id) : null;
        })
        .then((book) => {
          if (book) {
            book.lastUpdated = Date.now();
            appService.updateLibraryBook(book);
          }
        });
    });
  }, [id, fetchBook, bookState.content, envConfig]);

  const handleBack = () => {
    console.log('Back to bookshelf');
    router.back();
  };

  const handleTap = () => {
    setIsNavBarVisible((pre) => !pre);
  };

  return (
    <div className='min-h-screen bg-gray-100'>
      <div
        className={`absolute inset-0 z-20 ${isNavBarVisible ? 'mt-10' : 'ml-20 h-20'}`}
        onClick={handleTap}
      />
      <NavBar onBack={handleBack} isVisible={isNavBarVisible} />
      {bookState.loading && <Spinner loading={bookState.loading} />}
      {bookState.error && (
        <div className='text-center'>
          <h2 className='text-red-500'>{bookState.error}</h2>
        </div>
      )}
      {bookState.content && <ReaderContent content={bookState.content!} />}
    </div>
  );
};

export default ReaderPage;
