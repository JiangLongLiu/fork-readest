import React from 'react';
import { MdInfoOutline } from 'react-icons/md';
import { formatAuthors } from '@/utils/book';

interface BookCardProps {
  cover: string;
  title: string;
  author: string;
}

const BookCard: React.FC<BookCardProps> = ({ cover, title, author }) => {
  return (
    <div className='flex w-full items-center'>
      <img src={cover} alt='Book cover' className='mr-4 w-[15%] rounded-sm object-cover' />
      <div className='min-w-0 flex-1'>
        <h4 className='w-[90%] truncate text-base font-semibold'>{title}</h4>
        <p className='truncate text-sm text-gray-600'>{formatAuthors(author)}</p>
      </div>
      <button
        className='btn btn-ghost h-6 min-h-6 w-6 rounded-full p-0 transition-colors hover:bg-gray-300'
        aria-label='More info'
      >
        <MdInfoOutline size={18} className='text-gray-600' />
      </button>
    </div>
  );
};

export default BookCard;
