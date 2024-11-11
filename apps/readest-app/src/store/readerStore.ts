import { create } from 'zustand';

import {
  BookNote,
  BookContent,
  Book,
  BookConfig,
  PageInfo,
  BookProgress,
  ViewSettings,
} from '@/types/book';
import { EnvConfigType } from '@/services/environment';
import { SystemSettings } from '@/types/settings';
import { FoliateView } from '@/app/reader/components/FoliateViewer';
import { BookDoc, DocumentLoader, TOCItem } from '@/libs/document';
import { updateTocID } from '@/utils/toc';
import { TextSelection } from '@/utils/sel';

export interface BookData {
  /* Persistent data shared with different views of the same book */
  id: string;
  book: Book | null;
  file: File | null;
  config: BookConfig | null;
  bookDoc: BookDoc | null;
}

export interface ViewState {
  /* Unique key for each book view */
  key: string;
  view: FoliateView | null;
  isPrimary: boolean;
  loading: boolean;
  error: string | null;
  progress: BookProgress | null;
  ribbonVisible: boolean;
  /* View settings for the view: 
    generally view settings have a hirarchy of global settings < book settings < view settings
    view settings for primary view are saved to book config which is persisted to config file
    ommitting settings that are not changed from global settings */
  viewSettings: ViewSettings | null;
}

interface ReaderStore {
  library: Book[];
  settings: SystemSettings;

  booksData: { [id: string]: BookData };
  viewStates: { [key: string]: ViewState };

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
  setSideBarVisible: (visible: boolean) => void;
  setSideBarPin: (pinned: boolean) => void;

  notebookWidth: string;
  isNotebookVisible: boolean;
  isNotebookPinned: boolean;
  notebookNewAnnotation: TextSelection | null;
  notebookEditAnnotation: BookNote | null;
  setNotebookWidth: (width: string) => void;
  toggleNotebook: () => void;
  toggleNotebookPin: () => void;
  setNotebookVisible: (visible: boolean) => void;
  setNotebookPin: (pinned: boolean) => void;
  setNotebookNewAnnotation: (selection: TextSelection | null) => void;
  setNotebookEditAnnotation: (note: BookNote | null) => void;

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
  getProgress: (key: string) => BookProgress | null;
  setConfig: (key: string, config: BookConfig) => void;
  getConfig: (key: string | null) => BookConfig | null;
  setView: (key: string, view: FoliateView) => void;
  getView: (key: string | null) => FoliateView | null;
  getViewsById: (id: string) => FoliateView[];
  setViewSettings: (key: string, viewSettings: ViewSettings) => void;
  getViewSettings: (key: string) => ViewSettings | null;

  deleteBook: (envConfig: EnvConfigType, book: Book) => void;
  saveConfig: (
    envConfig: EnvConfigType,
    bookKey: string,
    config: BookConfig,
    settings: SystemSettings,
  ) => void;
  saveSettings: (envConfig: EnvConfigType, settings: SystemSettings) => void;
  initViewState: (envConfig: EnvConfigType, id: string, key: string, isPrimary?: boolean) => void;
  clearViewState: (key: string) => void;
  getBookData: (key: string) => BookData | null;
  getViewState: (key: string) => ViewState | null;
  updateBooknotes: (key: string, booknotes: BookNote[]) => BookConfig | undefined;
}

export const useReaderStore = create<ReaderStore>((set, get) => ({
  library: [],
  settings: {} as SystemSettings,

  booksData: {},
  viewStates: {},

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
  setSideBarVisible: (visible: boolean) => set({ isSideBarVisible: visible }),
  setSideBarPin: (pinned: boolean) => set({ isSideBarPinned: pinned }),

  notebookWidth: '',
  isNotebookVisible: false,
  isNotebookPinned: false,
  notebookNewAnnotation: null,
  notebookEditAnnotation: null,
  setNotebookWidth: (width: string) => set({ notebookWidth: width }),
  toggleNotebook: () => set((state) => ({ isNotebookVisible: !state.isNotebookVisible })),
  toggleNotebookPin: () => set((state) => ({ isNotebookPinned: !state.isNotebookPinned })),
  setNotebookVisible: (visible: boolean) => set({ isNotebookVisible: visible }),
  setNotebookPin: (pinned: boolean) => set({ isNotebookPinned: pinned }),
  setNotebookNewAnnotation: (selection: TextSelection | null) =>
    set({ notebookNewAnnotation: selection }),
  setNotebookEditAnnotation: (note: BookNote | null) => set({ notebookEditAnnotation: note }),

  isFontLayoutSettingsDialogOpen: false,
  isFontLayoutSettingsGlobal: true,
  setFontLayoutSettingsDialogOpen: (open: boolean) => set({ isFontLayoutSettingsDialogOpen: open }),
  setFontLayoutSettingsGlobal: (global: boolean) => set({ isFontLayoutSettingsGlobal: global }),

  setLibrary: (books: Book[]) => set({ library: books }),
  setSettings: (settings: SystemSettings) => set({ settings }),
  setConfig: (key: string, config: BookConfig) => {
    set((state) => {
      const bookData = state.booksData[key];
      if (!bookData) return state;
      return {
        booksData: {
          ...state.booksData,
          [key]: {
            ...bookData,
            config: {
              ...bookData.config,
              ...config,
              lastUpdated: Date.now(),
            },
          },
        },
      };
    });
  },

  getConfig: (key: string | null) => {
    if (!key) return null;
    const id = key.split('-')[0]!;
    return get().booksData[id]?.config || null;
  },

  setView: (key: string, view) =>
    set((state) => ({
      viewStates: { ...state.viewStates, [key]: { ...state.viewStates[key]!, view } },
    })),

  getView: (key: string | null) => (key && get().viewStates[key]?.view) || null,
  getViewsById: (id: string) => {
    const { viewStates } = get();
    return Object.values(viewStates)
      .filter((state) => state.key.startsWith(id))
      .map((state) => state.view!);
  },

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

  clearViewState: (key: string) => {
    set((state) => {
      const viewStates = { ...state.viewStates };
      delete viewStates[key];
      return { viewStates };
    });
  },
  initViewState: async (envConfig: EnvConfigType, id: string, key: string, isPrimary = true) => {
    const bookData = get().booksData[id];
    set((state) => ({
      viewStates: {
        ...state.viewStates,
        [key]: {
          key: '',
          view: null,
          isPrimary: false,
          loading: true,
          error: null,
          progress: null,
          ribbonVisible: false,
          viewSettings: null,
        },
      },
    }));
    try {
      if (!bookData) {
        const appService = await envConfig.getAppService();
        const { library, settings } = get();
        const book = library.find((b) => b.hash === id);
        if (!book) {
          throw new Error('Book not found');
        }
        const content = (await appService.loadBookContent(book, settings)) as BookContent;
        const { file, config } = content;
        console.log('Loading book', key);
        const { book: loadedBookDoc } = await new DocumentLoader(file).open();
        const bookDoc = loadedBookDoc as BookDoc;
        updateTocID(bookDoc.toc);
        set((state) => ({
          booksData: {
            ...state.booksData,
            [id]: { id, book, file, config, bookDoc },
          },
        }));
      }
      const config = get().booksData[id]?.config as BookConfig;
      const configViewSettings = config.viewSettings!;
      set((state) => ({
        viewStates: {
          ...state.viewStates,
          [key]: {
            ...state.viewStates[key],
            key,
            view: null,
            isPrimary,
            loading: false,
            error: null,
            progress: null,
            ribbonVisible: false,
            viewSettings: JSON.parse(JSON.stringify(configViewSettings)) as ViewSettings,
          },
        },
      }));
    } catch (error) {
      console.error(error);
      set((state) => ({
        viewStates: {
          ...state.viewStates,
          [key]: {
            ...state.viewStates[key],
            key: '',
            view: null,
            isPrimary: false,
            loading: false,
            error: 'Failed to load book.',
            progress: null,
            ribbonVisible: false,
            viewSettings: null,
          },
        },
      }));
    }
  },
  getBookData: (key: string) => {
    const id = key.split('-')[0]!;
    return get().booksData[id] || null;
  },
  getViewState: (key: string) => get().viewStates[key] || null,
  setViewSettings: (key: string, viewSettings: ViewSettings) => {
    const id = key.split('-')[0]!;
    const bookData = get().booksData[id];
    const viewState = get().viewStates[key];
    if (!viewState || !bookData) return;
    if (viewState.isPrimary) {
      set((state) => ({
        booksData: {
          ...state.booksData,
          [id]: {
            ...bookData,
            config: {
              ...bookData.config,
              lastUpdated: Date.now(),
              viewSettings,
            },
          },
        },
      }));
    }
    set((state) => ({
      viewStates: {
        ...state.viewStates,
        [key]: {
          ...state.viewStates[key]!,
          viewSettings,
        },
      },
    }));
  },
  getViewSettings: (key: string) => get().viewStates[key]?.viewSettings || null,
  setProgress: (
    key: string,
    location: string,
    tocItem: TOCItem,
    section: PageInfo,
    pageinfo: PageInfo,
    range: Range,
  ) =>
    set((state) => {
      const id = key.split('-')[0]!;
      const bookData = state.booksData[id];
      const viewState = state.viewStates[key];
      if (!viewState || !bookData) return state;
      const oldConfig = bookData.config;
      const newConfig = {
        ...bookData.config,
        lastUpdated: Date.now(),
        progress: [pageinfo.current, pageinfo.total] as [number, number],
        location,
      };
      return {
        booksData: {
          ...state.booksData,
          [id]: {
            ...bookData,
            config: viewState.isPrimary ? newConfig : oldConfig,
          },
        },
        viewStates: {
          ...state.viewStates,
          [key]: {
            ...viewState,
            progress: {
              ...viewState.progress,
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

  getProgress: (key: string) => get().viewStates[key]?.progress || null,

  setBookmarkRibbonVisibility: (key: string, visible: boolean) =>
    set((state) => ({
      viewStates: {
        ...state.viewStates,
        [key]: {
          ...state.viewStates[key]!,
          ribbonVisible: visible,
        },
      },
    })),

  updateBooknotes: (key: string, booknotes: BookNote[]) => {
    let updatedConfig: BookConfig | undefined;
    set((state) => {
      const id = key.split('-')[0]!;
      const book = state.booksData[id];
      if (!book) return state;
      const dedupedBooknotes = Array.from(
        new Map(booknotes.map((item) => [`${item.id}-${item.type}-${item.cfi}`, item])).values(),
      );
      updatedConfig = {
        ...book.config,
        lastUpdated: Date.now(),
        booknotes: dedupedBooknotes,
      };
      return {
        booksData: {
          ...state.booksData,
          [id]: {
            ...book,
            config: {
              ...book.config,
              lastUpdated: Date.now(),
              booknotes: dedupedBooknotes,
            },
          },
        },
      };
    });
    return updatedConfig;
  },
}));
