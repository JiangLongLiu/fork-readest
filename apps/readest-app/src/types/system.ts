import { SystemSettings } from './settings';
import { Book, BookConfig, BookContent } from './book';

export type BaseDir = 'Books' | 'Settings' | 'Data' | 'Log' | 'Cache' | 'None';
export type ToastType = 'info' | 'warning' | 'error';

export interface FileSystem {
  getURL(path: string): string;
  copyFile(srcPath: string, dstPath: string, base: BaseDir): Promise<void>;
  readFile(path: string, base: BaseDir, mode: 'text' | 'binary'): Promise<string | ArrayBuffer>;
  writeFile(path: string, base: BaseDir, content: string | ArrayBuffer): Promise<void>;
  removeFile(path: string, base: BaseDir): Promise<void>;
  readDir(path: string, base: BaseDir): Promise<{ path: string; isDir: boolean }[]>;
  createDir(path: string, base: BaseDir, recursive?: boolean): Promise<void>;
  removeDir(path: string, base: BaseDir, recursive?: boolean): Promise<void>;
  exists(path: string, base: BaseDir): Promise<boolean>;
}

export interface AppService {
  fs: FileSystem;

  selectDirectory(title: string): Promise<string>;
  selectFiles(name: string, extensions: string[]): Promise<string[]>;
  showMessage(msg: string, kind?: ToastType, title?: string, okLabel?: string): Promise<void>;

  loadSettings(): Promise<SystemSettings>;
  saveSettings(settings: SystemSettings): Promise<void>;
  importBook(file: string | File, books: Book[], overwrite?: boolean): Promise<Book[]>;
  deleteBook(book: Book): Promise<void>;
  loadBookConfig(book: Book): Promise<BookConfig>;
  saveBookConfig(book: Book, config: BookConfig): Promise<void>;
  loadBookContent(book: Book): Promise<BookContent>;
  loadLibraryBooks(): Promise<Book[]>;
  saveLibraryBooks(books: Book[]): Promise<void>;
  getCoverImageUrl(book: Book): string;
}
