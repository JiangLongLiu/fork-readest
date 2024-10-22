import { create } from 'zustand';

import { BookNote, BookContent, Book, BookConfig, PageInfo } from '@/types/book';
import { EnvConfigType } from '@/services/environment';
import { SystemSettings } from '@/types/settings';
import { FoliateView } from '@/app/reader/components/FoliateViewer';

interface BookState {
  loading?: boolean;
  error?: string | null;
  book?: Book | null;
  file?: File | null;
  config?: BookConfig | null;
}

interface ReaderStore {
  library: Book[];
  books: Record<string, BookState>;
  settings: SystemSettings;
  foliateView: FoliateView | null;

  setLibrary: (books: Book[]) => void;
  setSettings: (settings: SystemSettings) => void;
  setProgress: (
    id: string,
    progress: number,
    location: string,
    href: string,
    pageinfo: PageInfo,
  ) => void;
  setFoliateView: (view: FoliateView | null) => void;

  saveConfig: (envConfig: EnvConfigType, book: Book, config: BookConfig) => void;
  saveSettings: (envConfig: EnvConfigType, settings: SystemSettings) => void;

  fetchBook: (envConfig: EnvConfigType, id: string) => Promise<Book | null>;
  addBookmark: (id: string, bookmark: BookNote) => void;
}

export const useReaderStore = create<ReaderStore>((set, get) => ({
  library: [],
  books: {},
  settings: {} as SystemSettings,
  foliateView: null,

  setFoliateView: (view) => set({ foliateView: view }),
  setLibrary: (books: Book[]) => set({ library: books }),
  setSettings: (settings: SystemSettings) => set({ settings }),

  saveConfig: async (envConfig: EnvConfigType, book: Book, config: BookConfig) => {
    const appService = await envConfig.getAppService();
    const { library } = get();
    const bookIndex = library.findIndex((b) => b.hash === book.hash);
    if (bookIndex !== -1) {
      book.lastUpdated = Date.now();
      library[bookIndex] = book;
    }
    set({ library });
    config.lastUpdated = Date.now();
    appService.saveBookConfig(book, config);
    appService.saveLibraryBooks(library);
  },
  saveSettings: async (envConfig: EnvConfigType, settings: SystemSettings) => {
    const appService = await envConfig.getAppService();
    await appService.saveSettings(settings);
  },

  fetchBook: async (envConfig: EnvConfigType, id: string) => {
    set((state) => ({
      books: {
        ...state.books,
        [id]: { loading: true, file: null, book: null, config: null, error: null, notes: [] },
      },
    }));

    try {
      const appService = await envConfig.getAppService();
      const library = await appService.loadLibraryBooks();
      const book = library.find((b) => b.hash === id);
      if (!book) {
        throw new Error('Book not found');
      }
      const content = (await appService.loadBookContent(book)) as BookContent;
      const { file, config } = content;

      set((state) => ({
        books: {
          ...state.books,
          [id]: { ...state.books[id], loading: false, book, file, config },
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

  setProgress: (id: string, progress: number, location: string, href: string, pageinfo: PageInfo) =>
    set((state) => {
      const book = state.books[id];
      if (!book) return state;
      return {
        books: {
          ...state.books,
          [id]: {
            ...book,
            config: {
              ...book.config,
              lastUpdated: Date.now(),
              href,
              progress,
              location,
              pageinfo,
            },
          },
        },
      };
    }),

  addBookmark: (id: string, bookmark: BookNote) =>
    set((state) => {
      const book = state.books[id];
      if (!book) return state;
      return {
        books: {
          ...state.books,
          [id]: {
            ...book,
            config: {
              ...book.config,
              lastUpdated: Date.now(),
              bookmarks: [...(book.config?.bookmarks || []), bookmark],
            },
          },
        },
      };
    }),
}));
