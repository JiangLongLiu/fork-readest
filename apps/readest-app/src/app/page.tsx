'use client';

import * as React from 'react';
import { useState } from 'react';
import Image from 'next/image';
import { LayoutGrid, LayoutList } from 'lucide-react';
import styles from './library.module.css';

const BOOKS_DIR = '/Users/chrox/Documents/DigestLibrary/books';

const books = [
  { title: 'Book 1', thumbnail: `asset://localhost/${BOOKS_DIR}/book1.png` },
  { title: 'Book 2', thumbnail: `asset://localhost/${BOOKS_DIR}/book2.png` },
  { title: 'Book 3', thumbnail: `asset://localhost/${BOOKS_DIR}/book3.png` },
];

export default function LibraryPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');

  return (
    <div className={styles['libraryContainer']}>
      <div className={styles['viewToggle']}>
        <button
          onClick={() => setView('grid')}
          className={view === 'grid' ? styles['active'] : ''}
        >
          <LayoutGrid />
        </button>
        <button
          onClick={() => setView('list')}
          className={view === 'list' ? styles['active'] : ''}
        >
          <LayoutList />
        </button>
      </div>

      <div className={view === 'grid' ? styles['grid'] : styles['list']}>
        {books.map((book, index) => (
          <div key={index} className={styles['bookCard']}>
            <Image
              src={book.thumbnail}
              alt={book.title}
              width={20}
              height={30}
            />
            <h3>{book.title}</h3>
          </div>
        ))}
      </div>
    </div>
  );
}
