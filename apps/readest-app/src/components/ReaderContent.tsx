'use client';

import React from 'react';
import { BookContent } from '@/types/book';
import { BookDoc, DocumentLoader } from '@/libs/document';
import FoliateViewer from './FoliateViewer';

interface ReaderContentProps {
  content: BookContent;
}

const ReaderContent: React.FC<ReaderContentProps> = ({ content }) => {
  const [bookDoc, setBookDoc] = React.useState<BookDoc>();

  React.useEffect(() => {
    const loadDocument = async () => {
      if (content.file) {
        const { book } = await new DocumentLoader(content.file).open();
        setBookDoc(book);
      }
    };

    loadDocument();
  }, [content.file]);

  if (!content.file || !bookDoc) {
    return null;
  }

  return (
    <div>
      <FoliateViewer book={bookDoc} />
    </div>
  );
};

export default ReaderContent;
