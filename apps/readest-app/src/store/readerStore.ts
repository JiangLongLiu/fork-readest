import { create } from 'zustand';

import { BookNote, BookContent, Book, BookConfig, PageInfo } from '@/types/book';
import { EnvConfigType } from '@/services/environment';
import { SystemSettings } from '@/types/settings';
import { FoliateView } from '@/app/reader/components/FoliateViewer';
import { BookDoc, DocumentLoader } from '@/libs/document';

export interface BookState {
  key: string;
  loading?: boolean;
  error?: string | null;
  book?: Book | null;
  file?: File | null;
  config?: BookConfig | null;
  bookDoc?: BookDoc | null;
  isPrimary?: boolean;
}

interface ReaderStore {
  library: Book[];
  books: Record<string, BookState>;
  settings: SystemSettings;
  foliateViews: Record<string, FoliateView>;

  setLibrary: (books: Book[]) => void;
  setSettings: (settings: SystemSettings) => void;
  setProgress: (
    key: string,
    progress: number,
    location: string,
    href: string,
    pageinfo: PageInfo,
  ) => void;
  setFoliateView: (key: string, view: FoliateView) => void;
  getFoliateView: (key: string) => FoliateView | null;

  saveConfig: (envConfig: EnvConfigType, book: Book, config: BookConfig) => void;
  saveSettings: (envConfig: EnvConfigType, settings: SystemSettings) => void;

  initBookState: (envConfig: EnvConfigType, id: string, key: string, isPrimary?: boolean) => void;
  addBookmark: (key: string, bookmark: BookNote) => void;
}

export const DEFAULT_BOOK_STATE = {
  key: '',
  loading: true,
  error: null,
  file: null,
  book: null,
  config: null,
  bookDoc: null,
  isPrimary: true,
};

export const useReaderStore = create<ReaderStore>((set, get) => ({
  library: [],
  books: {},
  settings: {} as SystemSettings,
  foliateViews: {},

  setLibrary: (books: Book[]) => set({ library: books }),
  setSettings: (settings: SystemSettings) => set({ settings }),

  setFoliateView: (key: string, view) =>
    set((state) => ({ foliateViews: { ...state.foliateViews, [key]: view } })),

  getFoliateView: (key: string) => get().foliateViews[key] || null,

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

  initBookState: async (envConfig: EnvConfigType, id: string, key: string, isPrimary = true) => {
    set((state) => ({
      books: {
        ...state.books,
        [key]: DEFAULT_BOOK_STATE,
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
      const { book: bookDoc } = await new DocumentLoader(file).open();

      set((state) => ({
        books: {
          ...state.books,
          [key]: {
            ...state.books[key],
            loading: false,
            key,
            book,
            file,
            config,
            bookDoc,
            isPrimary,
          },
        },
      }));
      return content;
    } catch (error) {
      console.error(error);
      set((state) => ({
        books: {
          ...state.books,
          [key]: { ...state.books[key], key: '', loading: false, error: 'Failed to load book.' },
        },
      }));
      return null;
    }
  },

  setProgress: (
    key: string,
    progress: number,
    location: string,
    href: string,
    pageinfo: PageInfo,
  ) =>
    set((state) => {
      const book = state.books[key];
      if (!book) return state;
      return {
        books: {
          ...state.books,
          [key]: {
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

  addBookmark: (key: string, bookmark: BookNote) =>
    set((state) => {
      const book = state.books[key];
      if (!book) return state;
      return {
        books: {
          ...state.books,
          [key]: {
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
