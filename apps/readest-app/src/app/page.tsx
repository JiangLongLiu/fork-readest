'use client';

import * as React from 'react';
import { useState } from 'react';
import Image from 'next/image';
import { LayoutGrid, LayoutList } from 'lucide-react';
import { Book } from '../types/book';
import { useEnv } from '../context/EnvContext';
import styles from './library.module.css';

type AppState = 'Init' | 'Loading' | 'Library' | 'Reader';

const LibraryPage = () => {
  const { envConfig } = useEnv();
  const [appState, setAppState] = useState<AppState>('Init');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingInfo, setLoadingInfo] = useState<string>('');

  React.useEffect(() => {
    if (appState !== 'Init') return;
    setAppState('Loading');
    setLoadingInfo('Loading library books...');
    envConfig.appService().then((appService) => {
      appService.loadSettings().then((settings) => {
        console.log('Settings', settings);
        appService
          .loadLibraryBooks()
          .then((books) => {
            console.log('Library books:', books);
            setBooks(books);
            setAppState('Library');
            setLoadingInfo('');
          })
          .catch((err) => {
            console.error(err);
            setLoadingInfo('');
            appService.showMessage('Failed to load library books', 'error');
          });
      });
    });
  }, [envConfig, appState]);

  return (
    <div className={styles['libraryContainer']}>
      <div className={styles['viewToggle']}>
        <button onClick={() => setView('grid')} className={view === 'grid' ? styles['active'] : ''}>
          <LayoutGrid />
        </button>
        <button onClick={() => setView('list')} className={view === 'list' ? styles['active'] : ''}>
          <LayoutList />
        </button>
      </div>
      {loadingInfo && (
        <div>
          <span className='loading loading-dots loading-lg'></span>
          <p>{loadingInfo}</p>
        </div>
      )}
      {books.length > 0 ? (
        <div className={view === 'grid' ? styles['grid'] : styles['list']}>
          {books.map((book, index) => (
            <div key={index} className={styles['bookCard']}>
              <Image src={book.coverImageUrl!} alt={book.title} width={20} height={30} />
              <h3>{book.title}</h3>
            </div>
          ))}
        </div>
      ) : (
        <div className='hero min-h-screen'>
          <div className='hero-content text-neutral-content text-center'>
            <div className='max-w-md'>
              <h1 className='mb-5 text-5xl font-bold'>Your Library</h1>
              <p className='mb-5'>
                Welcome to your library. You can upload your books here and read them anytime.
              </p>
              <button className='btn btn-primary'>Upload Books</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryPage;
