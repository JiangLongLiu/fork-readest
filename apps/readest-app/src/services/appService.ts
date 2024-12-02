import { AppService, ToastType } from '@/types/system';

import { SystemSettings } from '@/types/settings';
import { FileSystem, BaseDir } from '@/types/system';
import { Book, BookConfig, BookContent, BookFormat, ViewSettings } from '@/types/book';
import {
  getDir,
  getFilename,
  getBaseFilename,
  getCoverFilename,
  getConfigFilename,
  getLibraryFilename,
  INIT_BOOK_CONFIG,
} from '@/utils/book';
import { RemoteFile } from '@/utils/file';
import { partialMD5 } from '@/utils/md5';
import { BookDoc, DocumentLoader } from '@/libs/document';
import {
  DEFAULT_BOOK_LAYOUT,
  DEFAULT_BOOK_STYLE,
  DEFAULT_BOOK_FONT,
  DEFAULT_READSETTINGS,
  SYSTEM_SETTINGS_VERSION,
  DEFAULT_BOOK_SEARCH_CONFIG,
} from './constants';

export abstract class BaseAppService implements AppService {
  localBooksDir: string = '';
  abstract isAppDataSandbox: boolean;
  abstract hasTrafficLight: boolean;
  abstract fs: FileSystem;

  abstract resolvePath(fp: string, base: BaseDir): { baseDir: number; base: BaseDir; fp: string };
  abstract getCoverImageUrl(book: Book): string;
  abstract getInitBooksDir(): Promise<string>;
  abstract selectDirectory(title: string): Promise<string>;
  abstract selectFiles(name: string, extensions: string[]): Promise<string[]>;
  abstract showMessage(
    msg: string,
    kind?: ToastType,
    title?: string,
    okLabel?: string,
  ): Promise<void>;

  async loadSettings(): Promise<SystemSettings> {
    let settings: SystemSettings;
    const { fp, base } = this.resolvePath('settings.json', 'Settings');

    try {
      await this.fs.exists(fp, base);
      const txt = await this.fs.readFile(fp, base, 'text');
      settings = JSON.parse(txt as string);
      const version = settings.version ?? 0;
      if (this.isAppDataSandbox || version < SYSTEM_SETTINGS_VERSION) {
        settings.localBooksDir = await this.getInitBooksDir();
        settings.version = SYSTEM_SETTINGS_VERSION;
      }
      settings.globalReadSettings = { ...DEFAULT_READSETTINGS, ...settings.globalReadSettings };
      settings.globalViewSettings = {
        ...DEFAULT_BOOK_LAYOUT,
        ...DEFAULT_BOOK_STYLE,
        ...DEFAULT_BOOK_FONT,
        ...settings.globalViewSettings,
      };
    } catch {
      settings = {
        version: SYSTEM_SETTINGS_VERSION,
        localBooksDir: await this.getInitBooksDir(),
        globalReadSettings: DEFAULT_READSETTINGS,
        globalViewSettings: {
          ...DEFAULT_BOOK_LAYOUT,
          ...DEFAULT_BOOK_STYLE,
          ...DEFAULT_BOOK_FONT,
        },
      };

      await this.fs.createDir('', 'Books', true);
      await this.fs.createDir('', base, true);
      await this.fs.writeFile(fp, base, JSON.stringify(settings));
    }

    this.localBooksDir = settings.localBooksDir;
    return settings;
  }

  async saveSettings(settings: SystemSettings): Promise<void> {
    const { fp, base } = this.resolvePath('settings.json', 'Settings');
    await this.fs.createDir('', base, true);
    await this.fs.writeFile(fp, base, JSON.stringify(settings));
  }

  async importBook(
    file: string | File,
    books: Book[],
    overwrite: boolean = false,
  ): Promise<Book[]> {
    try {
      let loadedBook: BookDoc;
      let format: BookFormat;
      let filename: string;
      let fileobj: File;

      try {
        if (typeof file === 'string') {
          filename = file;
          fileobj = await new RemoteFile(this.fs.getURL(file), file).open();
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
      book.coverImageUrl = this.getCoverImageUrl(book);

      if (!(await this.fs.exists(getDir(book), 'Books'))) {
        await this.fs.createDir(getDir(book), 'Books');
      }
      if (!(await this.fs.exists(getFilename(book), 'Books')) || overwrite) {
        if (typeof file === 'string') {
          await this.fs.copyFile(file, getFilename(book), 'Books');
        } else {
          await this.fs.writeFile(getFilename(book), 'Books', await file.arrayBuffer());
        }
      }
      if (!(await this.fs.exists(getCoverFilename(book), 'Books')) || overwrite) {
        const cover = await loadedBook.getCover();
        if (cover) {
          await this.fs.writeFile(getCoverFilename(book), 'Books', await cover.arrayBuffer());
        }
      }
      // Never overwrite the config file only when it's not existed
      if (!existingBook) {
        await this.saveBookConfig(book, INIT_BOOK_CONFIG);
        books.splice(0, 0, book);
      }
    } catch (error) {
      throw error;
    }

    return books;
  }

  async deleteBook(book: Book): Promise<void> {
    for (const fp of [getFilename(book), getCoverFilename(book)]) {
      if (await this.fs.exists(fp, 'Books')) {
        await this.fs.removeFile(fp, 'Books');
      }
    }
  }

  async loadBookContent(book: Book, settings: SystemSettings): Promise<BookContent> {
    const fp = getFilename(book);
    const file = await new RemoteFile(this.fs.getURL(`${this.localBooksDir}/${fp}`), fp).open();
    return { book, file, config: await this.loadBookConfig(book, settings) };
  }

  async loadBookConfig(book: Book, settings: SystemSettings): Promise<BookConfig> {
    try {
      const str = await this.fs.readFile(getConfigFilename(book), 'Books', 'text');
      const config = JSON.parse(str as string) as BookConfig;
      const { globalViewSettings } = settings;
      const { viewSettings } = config;
      config.viewSettings = { ...globalViewSettings, ...viewSettings };
      config.searchConfig ??= DEFAULT_BOOK_SEARCH_CONFIG;
      return config;
    } catch {
      return INIT_BOOK_CONFIG;
    }
  }

  async saveBookConfig(book: Book, config: BookConfig, settings?: SystemSettings) {
    if (settings) {
      config = JSON.parse(JSON.stringify(config));
      const globalViewSettings = settings.globalViewSettings as ViewSettings;
      const viewSettings = config.viewSettings as Partial<ViewSettings>;
      config.viewSettings = Object.entries(viewSettings).reduce(
        (acc: Partial<Record<keyof ViewSettings, unknown>>, [key, value]) => {
          if (globalViewSettings[key as keyof ViewSettings] !== value) {
            acc[key as keyof ViewSettings] = value;
          }
          return acc;
        },
        {} as Partial<Record<keyof ViewSettings, unknown>>,
      ) as Partial<ViewSettings>;
    }
    await this.fs.writeFile(getConfigFilename(book), 'Books', JSON.stringify(config));
  }

  async loadLibraryBooks(): Promise<Book[]> {
    console.log('Loading library books...');
    let books: Book[] = [];
    const libraryFilename = getLibraryFilename();

    try {
      const txt = await this.fs.readFile(libraryFilename, 'Books', 'text');
      books = JSON.parse(txt as string);
    } catch {
      await this.fs.createDir('', 'Books', true);
      await this.fs.writeFile(libraryFilename, 'Books', '[]');
    }

    books.forEach((book) => {
      book.coverImageUrl = this.getCoverImageUrl(book);
    });

    return books;
  }

  async saveLibraryBooks(books: Book[]): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const libraryBooks = books.map(({ coverImageUrl, ...rest }) => rest);
    await this.fs.writeFile(getLibraryFilename(), 'Books', JSON.stringify(libraryBooks));
  }
}
