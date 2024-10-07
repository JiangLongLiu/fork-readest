import { convertFileSrc } from '@tauri-apps/api/core';
import { open, message } from '@tauri-apps/plugin-dialog';
import { join, documentDir } from '@tauri-apps/api/path';

import { Book, BookConfig, BookFormat } from '../types/book';
import { SystemSettings } from '../types/settings';
import { AppService, ToastType } from '../types/system';
import { LOCAL_BOOKS_SUBDIR } from './constants';
import { resolvePath, nativeFileSystem } from './nativeFileSystem';
import {
  getBaseFilename,
  getConfigFilename,
  getCoverFilename,
  getDir,
  getFilename,
  getLibraryFilename,
  INIT_BOOK_CONFIG,
} from '@/utils/book';
import { BookDoc, DocumentLoader } from '@/libs/document';
import { RemoteFile } from '@/utils/file';
import { partialMD5 } from '@/utils/md5';

let BOOKS_DIR = '';

const SETTINGS_PATH = resolvePath('settings.json', 'Settings');

export const nativeAppService: AppService = {
  fs: nativeFileSystem,
  loadSettings: async () => {
    let settings: SystemSettings;
    const { fp, base } = SETTINGS_PATH;

    try {
      await nativeAppService.fs.exists(fp, base);
      const txt = await nativeAppService.fs.readFile(fp, base, 'text');
      settings = JSON.parse(txt as string);
    } catch {
      const INIT_BOOKS_DIR = await join(await documentDir(), LOCAL_BOOKS_SUBDIR);
      await nativeAppService.fs.createDir('', 'Books', true);
      settings = {
        localBooksDir: INIT_BOOKS_DIR,
        globalReadSettings: {
          themeType: 'auto',
          fontFamily: '',
          fontSize: 1.0,
          wordSpacing: 0.16,
          lineSpacing: 1.5,
        },
      };

      await nativeAppService.fs.createDir('', base, true);
      await nativeAppService.fs.writeFile(fp, base, JSON.stringify(settings));
    }

    BOOKS_DIR = settings.localBooksDir;
    return settings;
  },
  saveSettings: async (settings: SystemSettings) => {
    const { fp, base } = SETTINGS_PATH;
    await nativeAppService.fs.createDir('', base, true);
    await nativeAppService.fs.writeFile(fp, base, JSON.stringify(settings));
    BOOKS_DIR = settings.localBooksDir;
  },
  selectDirectory: async (title: string) => {
    const selected = await open({
      title,
      directory: true,
    });

    return selected as string;
  },
  selectFiles: async (name: string, extensions: string[]) => {
    const selected = await open({
      multiple: true,
      filters: [{ name, extensions }],
    });

    if (Array.isArray(selected)) {
      return selected;
    } else if (selected === null) {
      return [];
    } else {
      return [selected];
    }
  },
  showMessage: async (msg: string, kind: ToastType = 'info', title?: string, okLabel?: string) => {
    await message(msg, { kind, title, okLabel });
  },
  importBook: async (
    file: string | File,
    books: Book[],
    overwrite: boolean = false,
  ): Promise<Book[]> => {
    try {
      let loadedBook: BookDoc;
      let format: BookFormat;
      let filename: string;
      let fileobj: File;

      try {
        if (typeof file === 'string') {
          filename = file;
          fileobj = await new RemoteFile(nativeAppService.fs.getURL(file), file).open();
        } else {
          filename = file.name;
          fileobj = file;
        }
        ({ book: loadedBook, format } = await new DocumentLoader(fileobj).open());
        if (!loadedBook.metadata.title) {
          loadedBook.metadata.title = getBaseFilename(filename);
        }
      } catch (error) {
        console.error(error);
        throw new Error(`Failed to open the book: ${(error as Error).message || error}`);
      }

      const hash = await partialMD5(fileobj);
      const existingBook = books.filter((b) => b.hash === hash)[0];
      if (existingBook) {
        if (existingBook.isRemoved) {
          delete existingBook.isRemoved;
        }
        existingBook.lastUpdated = Date.now();
      }

      const book: Book = {
        hash,
        format,
        title: loadedBook.metadata.title,
        author: loadedBook.metadata.author,
        lastUpdated: Date.now(),
      };
      book.coverImageUrl = nativeAppService.getCoverImageUrl(book);

      if (!(await nativeAppService.fs.exists(getDir(book), 'Books'))) {
        await nativeAppService.fs.createDir(getDir(book), 'Books');
      }
      if (!(await nativeAppService.fs.exists(getFilename(book), 'Books')) || overwrite) {
        if (typeof file === 'string') {
          await nativeAppService.fs.copyFile(file, getFilename(book), 'Books');
        } else {
          await nativeAppService.fs.writeFile(getFilename(book), 'Books', await file.arrayBuffer());
        }
      }
      if (!(await nativeAppService.fs.exists(getCoverFilename(book), 'Books')) || overwrite) {
        const cover = await loadedBook.getCover();
        if (cover) {
          await nativeAppService.fs.writeFile(
            getCoverFilename(book),
            'Books',
            await cover.arrayBuffer(),
          );
        }
      }
      // Never overwrite the config file only when it's not existed
      if (!existingBook) {
        await nativeAppService.saveBookConfig(book, INIT_BOOK_CONFIG);
        books.splice(0, 0, book);
      }
    } catch (error) {
      throw error;
    }

    return books;
  },
  loadBookConfig: async (book: Book): Promise<BookConfig> => {
    try {
      const str = await nativeAppService.fs.readFile(getConfigFilename(book), 'Books', 'text');
      return JSON.parse(str as string);
    } catch {
      return INIT_BOOK_CONFIG;
    }
  },
  saveBookConfig: async (book: Book, config: BookConfig) => {
    await nativeAppService.fs.writeFile(getConfigFilename(book), 'Books', JSON.stringify(config));
  },
  loadLibraryBooks: async () => {
    let books: Book[] = [];
    const libraryFilename = getLibraryFilename();
    try {
      const txt = await nativeAppService.fs.readFile(libraryFilename, 'Books', 'text');
      books = JSON.parse(txt as string);
    } catch {
      await nativeAppService.fs.writeFile(libraryFilename, 'Books', '[]');
    }

    books.forEach((book) => {
      book.coverImageUrl = nativeAppService.getCoverImageUrl(book);
    });

    return books;
  },
  saveLibraryBooks: async (books: Book[]) => {
    await nativeAppService.fs.writeFile(getLibraryFilename(), 'Books', JSON.stringify(books));
  },
  getCoverImageUrl: (book: Book) => {
    return convertFileSrc(`${BOOKS_DIR}/${getCoverFilename(book)}`);
  },
};
