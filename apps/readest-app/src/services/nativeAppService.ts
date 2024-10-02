import {
  exists,
  mkdir,
  readTextFile,
  readFile,
  writeTextFile,
  writeFile,
  readDir,
  remove,
  BaseDirectory,
} from '@tauri-apps/plugin-fs';
import { type as osType } from '@tauri-apps/plugin-os';
import {
  join,
  appConfigDir,
  appDataDir,
  appCacheDir,
  appLogDir,
  documentDir,
} from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';
import { open, message } from '@tauri-apps/plugin-dialog';

import { Book, BooksGroup } from '../types/book';
import { SystemSettings } from '../types/settings';
import { AppService, BaseDir, ToastType } from '../types/system';

const IS_MOBILE = osType() === 'ios' || osType() === 'android';
const BOOKS_SUBDIR = 'DigestLibrary/Books';
let BOOKS_DIR = '';

const MOCK_BOOKS: Book[] = Array.from({ length: 14 }, (_v, k) => ({
  id: `book-${k}`,
  format: 'EPUB',
  title: `Book ${k}`,
  author: `Author ${k}`,
  lastUpdated: Date.now() - 1000000 * k,
  coverImageUrl: `https://placehold.co/800?text=Book+${k}&font=roboto`,
}));

function resolvePath(
  fp: string,
  base: BaseDir,
): { baseDir: number; base: BaseDir; fp: string; dir: () => Promise<string> } {
  switch (base) {
    case 'Settings':
      return { baseDir: BaseDirectory.AppConfig, fp, base, dir: appConfigDir };
    case 'Data':
      return { baseDir: BaseDirectory.AppData, fp, base, dir: appDataDir };
    case 'Cache':
      return { baseDir: BaseDirectory.AppCache, fp, base, dir: appCacheDir };
    case 'Log':
      return { baseDir: BaseDirectory.AppLog, fp, base, dir: appLogDir };
    case 'Books':
      return {
        baseDir: IS_MOBILE ? BaseDirectory.AppData : BaseDirectory.Document,
        fp: `${BOOKS_SUBDIR}/${fp}`,
        base,
        dir: () => new Promise((r) => r(`${BOOKS_DIR}/`)),
      };
    default:
      return {
        baseDir: BaseDirectory.Temp,
        fp,
        base,
        dir: () => new Promise((r) => r('')),
      };
  }
}

const SETTINGS_PATH = resolvePath('settings.json', 'Settings');

export const nativeAppService: AppService = {
  fs: {
    async readFile(path: string, base: BaseDir, mode: 'text' | 'binary') {
      const { fp, baseDir } = resolvePath(path, base);

      return mode === 'text'
        ? (readTextFile(fp, base && { baseDir }) as Promise<string>)
        : (await readFile(fp, base && { baseDir })).buffer;
    },
    async writeFile(path: string, base: BaseDir, content: string | ArrayBuffer) {
      const { fp, baseDir } = resolvePath(path, base);

      return typeof content === 'string'
        ? writeTextFile(fp, content, base && { baseDir })
        : writeFile(fp, new Uint8Array(content), base && { baseDir });
    },
    async removeFile(path: string, base: BaseDir) {
      const { fp, baseDir } = resolvePath(path, base);

      return remove(fp, base && { baseDir });
    },
    async createDir(path: string, base: BaseDir, recursive = false) {
      const { fp, baseDir } = resolvePath(path, base);

      await mkdir(fp, base && { baseDir, recursive });
    },
    async removeDir(path: string, base: BaseDir, recursive = false) {
      const { fp, baseDir } = resolvePath(path, base);

      await remove(fp, base && { baseDir, recursive });
    },
    async readDir(path: string, base: BaseDir) {
      const { fp, baseDir } = resolvePath(path, base);

      const list = await readDir(fp, base && { baseDir });
      return list.map((entity) => {
        return {
          path: entity.name,
          isDir: entity.isDirectory,
        };
      });
    },
    async exists(path: string, base: BaseDir) {
      const { fp, baseDir } = resolvePath(path, base);

      try {
        const res = await exists(fp, base && { baseDir });
        return res;
      } catch {
        return false;
      }
    },
  },
  loadSettings: async () => {
    let settings: SystemSettings;
    const { fp, base } = SETTINGS_PATH;

    try {
      await nativeAppService.fs.exists(fp, base);
      const txt = await nativeAppService.fs.readFile(fp, base, 'text');
      settings = JSON.parse(txt as string);
    } catch {
      const INIT_BOOKS_DIR = await join(
        IS_MOBILE ? await appDataDir() : await documentDir(),
        BOOKS_SUBDIR,
      );
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
  loadLibraryBooks: async () => {
    // TODO: Burrently only ungrouped books are supported
    let books: Book[] = [];
    try {
      const txt = await nativeAppService.fs.readFile('books.json', 'Books', 'text');
      books = JSON.parse(txt as string);
    } catch {
      await nativeAppService.fs.writeFile('books.json', 'Books', '[]');
    }

    books.forEach((book) => {
      book.coverImageUrl = nativeAppService.generateCoverUrl(book);
    });
    books = [...books, ...MOCK_BOOKS];
    const ungroupedBooks: BooksGroup[] = [
      {
        id: 'ungrouped',
        name: 'Ungrouped',
        books,
        lastUpdated: Date.now(),
      },
    ];
    return ungroupedBooks;
  },
  generateCoverUrl: (book: Book) => {
    return convertFileSrc(`${BOOKS_DIR}/${book.id}/cover.png`);
  },
};
