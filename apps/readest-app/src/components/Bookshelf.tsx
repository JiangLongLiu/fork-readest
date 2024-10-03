import * as React from 'react';
import Image from 'next/image';
import { Book, BooksGroup, LibraryItem } from '../types/book';
import { FaPlus } from 'react-icons/fa';

interface BookshelfProps {
  libraryItems: LibraryItem[];
  onImport: () => void;
}

const Bookshelf: React.FC<BookshelfProps> = ({ libraryItems, onImport }) => {
  return (
    <div>
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
            onClick={onImport}
          >
            <FaPlus className='size-8' color='gray' />
          </div>
        )}
      </div>
    </div>
  );
};

export default Bookshelf;
