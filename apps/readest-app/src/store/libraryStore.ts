import { create } from 'zustand';
import { Book } from '@/types/book';
import { EnvConfigType } from '@/services/environment';

interface LibraryState {
  library: Book[];
  setLibrary: (books: Book[]) => void;
  deleteBook: (envConfig: EnvConfigType, book: Book) => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  library: [],
  setLibrary: (books) => set({ library: books }),
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
}));
