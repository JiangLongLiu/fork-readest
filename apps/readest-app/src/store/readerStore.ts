import { create } from 'zustand';

import { BookNote, BookContent, Book } from '@/types/book';
import { AppService } from '@/types/system';

interface BookState {
  loading?: boolean;
  content?: BookContent | null;
  error?: string | null;
  notes?: BookNote[];
}

interface ReaderStore {
  books: Record<string, BookState>;
  fetchBook: (appService: AppService, id: string) => Promise<Book | null>;
  addNote: (id: string, note: BookNote) => void;
}

export const useReaderStore = create<ReaderStore>((set) => {
  return {
    books: {},

    fetchBook: async (appService: AppService, id: string) => {
      set((state) => ({
        books: {
          ...state.books,
          [id]: { loading: true, content: null, error: null, notes: [] },
        },
      }));

      try {
        const library = await appService.loadLibraryBooks();
        const book = library.find((b) => b.hash === id);
        if (!book) {
          throw new Error('Book not found');
        }
        const content = (await appService.loadBookContent(book)) as BookContent;

        set((state) => ({
          books: {
            ...state.books,
            [id]: { ...state.books[id], loading: false, content },
          },
        }));
        return book;
      } catch (error) {
        console.error(error);
        set((state) => ({
          books: {
            ...state.books,
            [id]: { ...state.books[id], loading: false, error: 'Failed to load book.' },
          },
        }));
        return null;
      }
    },

    addNote: (id: string, note: BookNote) =>
      set((state) => ({
        books: {
          ...state.books,
          [id]: {
            ...state.books[id],
            notes: [...state.books[id]!.notes!, note],
          },
        },
      })),
  };
});
