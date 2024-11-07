import { create } from 'zustand';

import { BookNote, BookContent, Book, BookConfig, PageInfo, BookProgress } from '@/types/book';
import { EnvConfigType } from '@/services/environment';
import { SystemSettings } from '@/types/settings';
import { FoliateView } from '@/app/reader/components/FoliateViewer';
import { BookDoc, DocumentLoader, TOCItem } from '@/libs/document';

export interface BookState {
  key: string;
  loading?: boolean;
  error?: string | null;
  book?: Book | null;
  file?: File | null;
  config?: BookConfig | null;
  progress?: BookProgress | null;
  bookDoc?: BookDoc | null;
  isPrimary?: boolean;
}

interface ReaderStore {
  library: Book[];
  settings: SystemSettings;

  books: Record<string, BookState>;
  foliateViews: Record<string, FoliateView>;
  bookDocCache: Record<string, BookDoc>;
  bookmarkRibbons: Record<string, boolean>;

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

  setBookmarkRibbonVisibility: (key: string, visible: boolean) => void;

  isFontLayoutSettingsDialogOpen: boolean;
  isFontLayoutSettingsGlobal: boolean;
  setFontLayoutSettingsDialogOpen: (open: boolean) => void;
  setFontLayoutSettingsGlobal: (global: boolean) => void;

  setLibrary: (books: Book[]) => void;
  setSettings: (settings: SystemSettings) => void;
  setProgress: (
    key: string,
    location: string,
    tocItem: TOCItem,
    section: PageInfo,
    pageinfo: PageInfo,
    range: Range,
  ) => void;
  setConfig: (key: string, config: BookConfig) => void;
  setFoliateView: (key: string, view: FoliateView) => void;
  getFoliateView: (key: string | null) => FoliateView | null;

  deleteBook: (envConfig: EnvConfigType, book: Book) => void;
  saveConfig: (
    envConfig: EnvConfigType,
    bookKey: string,
    config: BookConfig,
    settings: SystemSettings,
  ) => void;
  saveSettings: (envConfig: EnvConfigType, settings: SystemSettings) => void;
  initBookState: (envConfig: EnvConfigType, id: string, key: string, isPrimary?: boolean) => void;

  clearBookState: (key: string) => void;
  updateBooknotes: (key: string, booknotes: BookNote[]) => BookConfig | undefined;
}

export const DEFAULT_BOOK_STATE = {
  key: '',
  loading: true,
  error: null,
  file: null,
  book: null,
  config: null,
  progress: null,
  bookDoc: null,
  isPrimary: true,
};

export const useReaderStore = create<ReaderStore>((set, get) => ({
  library: [],
  settings: {} as SystemSettings,

  books: {},
  foliateViews: {},
  bookDocCache: {},
  bookmarkRibbons: {},

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

  isFontLayoutSettingsDialogOpen: false,
  isFontLayoutSettingsGlobal: true,
  setFontLayoutSettingsDialogOpen: (open: boolean) => set({ isFontLayoutSettingsDialogOpen: open }),
  setFontLayoutSettingsGlobal: (global: boolean) => set({ isFontLayoutSettingsGlobal: global }),

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
    bookKey: string,
    config: BookConfig,
    settings: SystemSettings,
  ) => {
    const appService = await envConfig.getAppService();
    const { library } = get();
    const bookIndex = library.findIndex((b) => b.hash === bookKey.split('-')[0]);
    if (bookIndex == -1) return;
    const book = library[bookIndex]!;
    book.lastUpdated = Date.now();
    library[bookIndex] = book;
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
        const updateTocID = (items: TOCItem[], index = 0): number => {
          items.forEach((item) => {
            if (item.id === undefined) {
              item.id = index++;
            }
            if (item.subitems) {
              index = updateTocID(item.subitems, index);
            }
          });
          return index;
        };
        updateTocID(bookDoc.toc);
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
            progress: {} as BookProgress,
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
    location: string,
    tocItem: TOCItem,
    section: PageInfo,
    pageinfo: PageInfo,
    range: Range,
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
              href: tocItem?.href,
              chapter: tocItem?.label,
              progress: [pageinfo.current, pageinfo.total],
              location,
              section,
              pageinfo,
            },
            progress: {
              ...book.progress,
              progress: [pageinfo.current, pageinfo.total],
              location,
              tocHref: tocItem?.href,
              tocLabel: tocItem?.label,
              tocId: tocItem?.id,
              section,
              pageinfo,
              range,
            },
          },
        },
      };
    }),

  setBookmarkRibbonVisibility: (key: string, visible: boolean) =>
    set((state) => ({
      bookmarkRibbons: {
        ...state.bookmarkRibbons,
        [key]: visible,
      },
    })),

  updateBooknotes: (key: string, booknotes: BookNote[]) => {
    let updatedConfig: BookConfig | undefined;
    set((state) => {
      const book = state.books[key];
      if (!book) return state;
      updatedConfig = {
        ...book.config,
        lastUpdated: Date.now(),
        booknotes,
      };
      return {
        books: {
          ...state.books,
          [key]: {
            ...book,
            config: {
              ...book.config,
              lastUpdated: Date.now(),
              booknotes,
            },
          },
        },
      };
    });
    return updatedConfig;
  },
}));
