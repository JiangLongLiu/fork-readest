import * as React from 'react';
import { FaPlus } from 'react-icons/fa';
import { MdDelete, MdOpenInNew } from 'react-icons/md';
import { MdCheckCircle, MdCheckCircleOutline } from 'react-icons/md';

import { useRouter } from 'next/navigation';
import Image from 'next/image';

import { Book, BooksGroup } from '@/types/book';
import Alert from '@/components/Alert';
import { useReaderStore } from '@/store/readerStore';
import { useEnv } from '@/context/EnvContext';

type BookshelfItem = Book | BooksGroup;

const UNGROUPED_NAME = 'ungrouped';

const generateBookshelfItems = (books: Book[]): BookshelfItem[] => {
  const groups: BooksGroup[] = books.reduce((acc: BooksGroup[], book: Book) => {
    book.group = book.group || UNGROUPED_NAME;
    const groupIndex = acc.findIndex((group) => group.name === book.group);
    const booksGroup = acc[acc.findIndex((group) => group.name === book.group)];
    if (booksGroup) {
      booksGroup.books.push(book);
      booksGroup.lastUpdated = Math.max(acc[groupIndex]!.lastUpdated, book.lastUpdated);
    } else {
      acc.push({
        name: book.group,
        books: [book],
        lastUpdated: book.lastUpdated,
      });
    }
    return acc;
  }, []);
  const ungroupedBooks: Book[] = groups.find((group) => group.name === UNGROUPED_NAME)?.books || [];
  const groupedBooks: BooksGroup[] = groups.filter((group) => group.name !== UNGROUPED_NAME);
  return [...ungroupedBooks, ...groupedBooks].sort((a, b) => b.lastUpdated - a.lastUpdated);
};

interface BookshelfProps {
  libraryBooks: Book[];
  isSelectMode: boolean;
  onImportBooks: () => void;
}

const Bookshelf: React.FC<BookshelfProps> = ({ libraryBooks, isSelectMode, onImportBooks }) => {
  const router = useRouter();
  const { envConfig } = useEnv();
  const { deleteBook } = useReaderStore();
  const [selectedBooks, setSelectedBooks] = React.useState<string[]>([]);
  const [showDeleteAlert, setShowDeleteAlert] = React.useState(false);
  const [clickedImage, setClickedImage] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSelectedBooks([]);
  }, [isSelectMode]);

  const bookshelfItems = generateBookshelfItems(libraryBooks);

  const handleBookClick = (id: string) => {
    if (isSelectMode) {
      toggleSelection(id);
    } else {
      setClickedImage(id);
      setTimeout(() => setClickedImage(null), 300);
      router.push(`/reader?ids=${id}`);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedBooks((prev) =>
      prev.includes(id) ? prev.filter((bookId) => bookId !== id) : [...prev, id],
    );
  };

  const openSelectedBooks = () => {
    router.push(`/reader?ids=${selectedBooks.join(',')}`);
  };

  const confirmDelete = () => {
    for (const selectedBook of selectedBooks) {
      const book = libraryBooks.find((b) => b.hash === selectedBook);
      if (book) {
        deleteBook(envConfig, book);
      }
    }
    setSelectedBooks([]);
    setShowDeleteAlert(false);
  };

  const deleteSelectedBooks = () => {
    setShowDeleteAlert(true);
  };

  return (
    <div className='bookshelf'>
      <div className='grid grid-cols-3 gap-0 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8'>
        {bookshelfItems.map((item, index) => (
          <div
            key={`library-item-${index}`}
            className='flex h-full flex-col rounded-md p-4 hover:bg-gray-200'
          >
            <div className='flex-grow'>
              {'format' in item ? (
                <div
                  className='book-item cursor-pointer'
                  onClick={() => handleBookClick(item.hash)}
                >
                  <div key={(item as Book).hash} className='card bg-base-100 shadow-md'>
                    <div className='relative aspect-[28/41]'>
                      <Image
                        src={(item as Book).coverImageUrl!}
                        alt={(item as Book).title}
                        fill={true}
                        className='object-cover'
                      />
                      {(selectedBooks.includes(item.hash) || clickedImage === item.hash) && (
                        <div className='absolute inset-0 bg-black opacity-30 transition-opacity duration-300'></div>
                      )}
                      {isSelectMode && (
                        <div className='absolute bottom-1 right-1'>
                          {selectedBooks.includes(item.hash) ? (
                            <MdCheckCircle size={20} className='fill-blue-500' />
                          ) : (
                            <MdCheckCircleOutline
                              size={20}
                              className='fill-gray-300 drop-shadow-sm'
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className='card-body p-0 pt-2'>
                    <h4 className='card-title line-clamp-1 text-[0.6em] text-xs font-semibold'>
                      {(item as Book).title}
                    </h4>
                  </div>
                </div>
              ) : (
                <div>
                  {(item as BooksGroup).books.map((book) => (
                    <div key={book.hash} className='card bg-base-100 w-full shadow-md'>
                      <figure>
                        <Image
                          width={10}
                          height={10}
                          src={book.coverImageUrl!}
                          alt={book.title || ''}
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

        {bookshelfItems.length > 0 && (
          <div
            className='border-1 m-4 flex aspect-[28/41] items-center justify-center bg-white hover:bg-gray-200'
            role='button'
            onClick={onImportBooks}
          >
            <FaPlus className='size-8' color='gray' />
          </div>
        )}
      </div>
      {selectedBooks.length > 0 && (
        <div className='fixed bottom-4 left-1/2 flex -translate-x-1/2 transform space-x-4 rounded-lg bg-gray-800 p-4 text-white shadow-lg'>
          <button onClick={openSelectedBooks} className='flex items-center space-x-2'>
            <MdOpenInNew />
            <span>Open</span>
          </button>
          <button onClick={deleteSelectedBooks} className='flex items-center space-x-2'>
            <MdDelete className='fill-red-500' />
            <span className='text-red-500'>Delete</span>
          </button>
        </div>
      )}
      {showDeleteAlert && (
        <Alert
          title='Confirm Deletion'
          message='Are you sure to delete the selected books?'
          onClickCancel={() => setShowDeleteAlert(false)}
          onClickConfirm={confirmDelete}
        />
      )}
    </div>
  );
};

export default Bookshelf;
