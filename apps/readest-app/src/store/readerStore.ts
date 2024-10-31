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
  settings: SystemSettings;

  books: Record<string, BookState>;
  foliateViews: Record<string, FoliateView>;
  bookDocCache: Record<string, BookDoc>;

  hoveredBookKey: string | null;
  sideBarBookKey: string | null;
  setHoveredBookKey: (key: string) => void;
  setSideBarBookKey: (key: string) => void;

  sideBarWidth: string;
  isSideBarVisible: boolean;
  isSideBarPinned: boolean;
  setSideBarWidth: (width: string) => void;
  toggleSideBar: () => void;
  toggleSideBarPin: () => void;
  setSideBarVisibility: (visible: boolean) => void;
  setSideBarPin: (pinned: boolean) => void;

  setLibrary: (books: Book[]) => void;
  setSettings: (settings: SystemSettings) => void;
  setProgress: (
    key: string,
    progress: number,
    location: string,
    href: string,
    chapter: string,
    section: PageInfo,
    pageinfo: PageInfo,
  ) => void;
  setConfig: (key: string, config: BookConfig) => void;
  setFoliateView: (key: string, view: FoliateView) => void;
  getFoliateView: (key: string | null) => FoliateView | null;

  deleteBook: (envConfig: EnvConfigType, book: Book) => void;
  saveConfig: (
    envConfig: EnvConfigType,
    book: Book,
    config: BookConfig,
    settings: SystemSettings,
  ) => void;
  saveSettings: (envConfig: EnvConfigType, settings: SystemSettings) => void;
  initBookState: (envConfig: EnvConfigType, id: string, key: string, isPrimary?: boolean) => void;

  clearBookState: (key: string) => void;
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
  settings: {} as SystemSettings,

  books: {},
  foliateViews: {},
  bookDocCache: {},

  hoveredBookKey: null,
  sideBarBookKey: null,
  setHoveredBookKey: (key: string) => set({ hoveredBookKey: key }),
  setSideBarBookKey: (key: string) => set({ sideBarBookKey: key }),

  sideBarWidth: '',
  isSideBarVisible: false,
  isSideBarPinned: false,
  setSideBarWidth: (width: string) => set({ sideBarWidth: width }),
  toggleSideBar: () => set((state) => ({ isSideBarVisible: !state.isSideBarVisible })),
  toggleSideBarPin: () => set((state) => ({ isSideBarPinned: !state.isSideBarPinned })),
  setSideBarVisibility: (visible: boolean) => set({ isSideBarVisible: visible }),
  setSideBarPin: (pinned: boolean) => set({ isSideBarPinned: pinned }),

  setLibrary: (books: Book[]) => set({ library: books }),
  setSettings: (settings: SystemSettings) => set({ settings }),
  setConfig: (key: string, config: BookConfig) => {
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
              ...config,
              lastUpdated: Date.now(),
            },
          },
        },
      };
    });
  },

  setFoliateView: (key: string, view) =>
    set((state) => ({ foliateViews: { ...state.foliateViews, [key]: view } })),

  getFoliateView: (key: string | null) => (key && get().foliateViews[key]) || null,

  deleteBook: async (envConfig: EnvConfigType, book: Book) => {
    const appService = await envConfig.getAppService();
    const { library } = get();
    const bookIndex = library.findIndex((b) => b.hash === book.hash);
    if (bookIndex !== -1) {
      library.splice(bookIndex, 1);
      appService.deleteBook(book);
    }
    set({ library });
    appService.saveLibraryBooks(library);
  },
  saveConfig: async (
    envConfig: EnvConfigType,
    book: Book,
    config: BookConfig,
    settings: SystemSettings,
  ) => {
    const appService = await envConfig.getAppService();
    const { library } = get();
    const bookIndex = library.findIndex((b) => b.hash === book.hash);
    if (bookIndex !== -1) {
      book.lastUpdated = Date.now();
      library[bookIndex] = book;
    }
    set({ library });
    config.lastUpdated = Date.now();
    appService.saveBookConfig(book, config, settings);
    appService.saveLibraryBooks(library);
  },
  saveSettings: async (envConfig: EnvConfigType, settings: SystemSettings) => {
    const appService = await envConfig.getAppService();
    await appService.saveSettings(settings);
  },

  clearBookState: (key: string) => {
    set((state) => {
      const books = { ...state.books };
      delete books[key];
      return { books };
    });
  },
  initBookState: async (envConfig: EnvConfigType, id: string, key: string, isPrimary = true) => {
    const cache = get().bookDocCache || {};

    set((state) => ({
      books: {
        ...state.books,
        [key]: DEFAULT_BOOK_STATE,
      },
    }));

    try {
      const appService = await envConfig.getAppService();
      const { library, settings } = get();
      const book = library.find((b) => b.hash === id);
      if (!book) {
        throw new Error('Book not found');
      }
      const content = (await appService.loadBookContent(book, settings)) as BookContent;
      const { file, config } = content;
      let bookDoc: BookDoc;
      if (cache[id]) {
        console.log('Using cached bookDoc for book', key);
        bookDoc = cache[id];
      } else {
        console.log('Loading book', key);
        const { book: loadedBookDoc } = await new DocumentLoader(file).open();
        bookDoc = loadedBookDoc as BookDoc;
        set((state) => ({
          bookDocCache: {
            ...state.bookDocCache,
            [id]: bookDoc,
          },
        }));
      }

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
    chapter: string,
    section: PageInfo,
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
              chapter,
              progress,
              location,
              section,
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
