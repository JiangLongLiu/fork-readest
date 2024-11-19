import React from 'react';
import Image from 'next/image';
import { MdInfoOutline } from 'react-icons/md';
import { formatAuthors } from '@/utils/book';

interface BookCardProps {
  cover: string;
  title: string;
  author: string;
}

const BookCard: React.FC<BookCardProps> = ({ cover, title, author }) => {
  return (
    <div className='flex h-20 w-full items-center'>
      <Image
        src={cover}
        alt='Book cover'
        width={56}
        height={80}
        className='mr-4 aspect-auto max-h-20 w-[15%] max-w-14 rounded-sm object-cover shadow-md'
      />
      <div className='min-w-0 flex-1'>
        <h4 className='line-clamp-2 w-[90%] text-sm font-semibold'>{title}</h4>
        <p className='text-neutral-content truncate text-sm'>{formatAuthors(author)}</p>
      </div>
      <button
        className='btn btn-ghost hover:bg-base-300 h-6 min-h-6 w-6 rounded-full p-0 transition-colors'
        aria-label='More info'
      >
        <MdInfoOutline size={18} className='fill-base-content' />
      </button>
    </div>
  );
};

export default BookCard;
