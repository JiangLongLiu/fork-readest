'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';

import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { BookDoc, DocumentLoader } from '@/libs/document';

import Spinner from '@/components/Spinner';
import FoliateViewer from './FoliateViewer';

const ReaderContent = () => {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const [bookDoc, setBookDoc] = React.useState<BookDoc>();
  const { envConfig } = useEnv();
  const { books, fetchBook } = useReaderStore();
  const bookState = books[id!] || { loading: true, content: null, error: null };

  React.useEffect(() => {
    if (id && !bookState.content) {
      envConfig.initAppService().then((appService) => {
        fetchBook(appService, id).then((book) => {
          if (book) {
            book.lastUpdated = Date.now();
            appService.updateLibraryBook(book);
          }
        });
      });
    }
    const loadDocument = async () => {
      const content = bookState.content;
      if (content) {
        const { book } = await new DocumentLoader(content.file).open();
        setBookDoc(book);
      }
    };
    if (bookState.content) {
      loadDocument();
    }
  }, [bookState.content, envConfig, fetchBook, id]);

  if (!bookDoc) {
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
      <FoliateViewer book={bookDoc} />
    </div>
  );
};

export default ReaderContent;
