'use client';

import * as React from 'react';
import { useState } from 'react';
import Image from 'next/image';
import { Book, BooksGroup } from '../types/book';
import { useEnv } from '../context/EnvContext';
import { FaSearch, FaPlus } from 'react-icons/fa';

type AppState = 'Init' | 'Loading' | 'Library' | 'Reader';
type LibraryItem = Book | BooksGroup;

const generateLibraryItems = (groups: BooksGroup[]): LibraryItem[] => {
  const ungroupedBooks: Book[] = groups.find((group) => group.id === 'ungrouped')?.books || [];
  const groupedBooks: BooksGroup[] = groups.filter((group) => group.id !== 'ungrouped');
  return [...ungroupedBooks, ...groupedBooks].sort((a, b) => b.lastUpdated - a.lastUpdated);
};

const LibraryPage = () => {
  const { envConfig } = useEnv();
  const [appState, setAppState] = useState<AppState>('Init');
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
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
          .then((libraryBooks) => {
            const libraryItems = generateLibraryItems(libraryBooks);
            console.log('Library items:', libraryItems);
            setLibraryItems(libraryItems);
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

  const handleImport = () => {
    // logic to import books
    console.log('Importing books...');
  };

  return (
    <div className='min-h-screen bg-gray-100'>
      {/* Sticky Top Navbar */}
      <div className='fixed top-0 z-10 w-full bg-gray-100 p-6'>
        <div className='flex items-center justify-between'>
          {/* Search Input with Magnifier and Plus Icon */}
          <div className='sm:w relative flex w-full items-center'>
            {/* Magnifier Icon */}
            <span className='absolute left-4 text-gray-500'>
              <FaSearch className='w-3' />
            </span>
            {/* Search Input */}
            <input
              type='text'
              placeholder='Search books...'
              className='input input-sm rounded-badge w-full bg-gray-200 pl-10 pr-10 focus:border-none focus:outline-none' // Padding-right added for FaPlus
            />
            {/* Plus Icon */}
            <span className='dropdown dropdown-end absolute right-4 cursor-pointer text-gray-500'>
              <FaPlus tabIndex={0} className='w-3' role='button' />
              <ul
                tabIndex={0}
                className='dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow'
              >
                <li>
                  <button onClick={handleImport}>From Local File</button>
                </li>
              </ul>
            </span>
          </div>
        </div>
      </div>
      <div className='min-h-screen p-2 pt-16'>
        <div className='hero-content'>
          {loadingInfo && (
            <div className='absolute left-1/2 top-4 -translate-x-1/2 transform pt-16 text-center'>
              {/* Spacer to offset fixed navbar height */}
              <span className='loading loading-dots loading-lg'></span>
            </div>
          )}
          {/* Books Grid */}
          <div className='grid grid-cols-3 gap-6 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8'>
            {libraryItems.map((item, index) => (
              <div key={`library-item-${index}`} className=''>
                <div className='grid gap-2'>
                  {'format' in item ? (
                    <div>
                      <div key={(item as Book).id} className='card bg-base-100 w-full shadow-md'>
                        <Image
                          width={10}
                          height={10}
                          src={(item as Book).coverImageUrl!}
                          alt={(item as Book).title}
                          className='aspect-[28/41] w-full object-cover'
                        />
                      </div>
                      <div className='card-body p-0 pt-2'>
                        <h3 className='card-title text-sm'>{(item as Book).title}</h3>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {(item as BooksGroup).books.map((book) => (
                        <div key={book.id} className='card bg-base-100 w-full shadow-md'>
                          <figure>
                            <Image
                              width={10}
                              height={10}
                              src={book.coverImageUrl!}
                              alt={book.title}
                              className='h-48 w-full object-cover'
                            />
                          </figure>
                        </div>
                      ))}
                      <h2 className='mb-2 text-lg font-bold'>{(item as BooksGroup).name}</h2>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {libraryItems.length > 0 && (
              <div
                className='border-1 flex aspect-[28/41] items-center justify-center bg-white'
                role='button'
                onClick={handleImport}
              >
                <FaPlus size='2rem' color='gray' />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LibraryPage;
