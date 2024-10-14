'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';

import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { BookDoc, DocumentLoader } from '@/libs/document';

import Spinner from '@/components/Spinner';
import FoliateViewer from './FoliateViewer';

interface ReaderContentProps {
  isClosingBook: boolean;
}

const ReaderContent: React.FC<ReaderContentProps> = ({ isClosingBook }) => {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const [bookDoc, setBookDoc] = React.useState<BookDoc>();
  const { envConfig } = useEnv();
  const { library, books, fetchBook, setLibrary } = useReaderStore();
  const defaultBookState = { loading: true, error: null, file: null, book: null, config: null };
  const bookState = id ? books[id] || defaultBookState : defaultBookState;

  React.useEffect(() => {
    if (!id) {
      return;
    }
    const { file, book, config } = bookState;
    if (isClosingBook) {
      if (book && config) {
        book.lastUpdated = Date.now();
        const bookIndex = library.findIndex((b) => b.hash === book.hash);
        if (bookIndex !== -1) {
          library[bookIndex] = book;
        }
        setLibrary(library);
        envConfig.initAppService().then((appService) => {
          config.lastUpdated = Date.now();
          appService.saveBookConfig(book, config);
          appService.saveLibraryBooks(library);
        });
      }
      return;
    }
    if (id && !file) {
      envConfig.initAppService().then((appService) => {
        fetchBook(appService, id);
      });
    }
    if (!bookDoc && bookState.file) {
      const loadDocument = async () => {
        if (file) {
          const { book } = await new DocumentLoader(file).open();
          setBookDoc(book);
        }
      };
      loadDocument();
    }
    return;
  }, [isClosingBook, bookState.file, envConfig, fetchBook, id]);

  if (!id || !bookDoc || !bookState.config) {
    return null;
  }

  return (
    <div>
      {bookState.loading && <Spinner loading={bookState.loading} />}
      {bookState.error && (
        <div className='text-center'>
          <h2 className='text-red-500'>{bookState.error}</h2>
        </div>
      )}
      <FoliateViewer bookId={id} bookDoc={bookDoc} bookConfig={bookState.config} />
    </div>
  );
};

export default ReaderContent;
