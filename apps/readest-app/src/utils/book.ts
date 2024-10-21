import { EXTS } from '@/libs/document';
import { Book, BookConfig } from '@/types/book';

export const getDir = (book: Book) => {
  return `${book.hash}`;
};
export const getLibraryFilename = () => {
  return 'library.json';
};
export const getFilename = (book: Book) => {
  return `${book.hash}/${book.title}.${EXTS[book.format]}`;
};
export const getCoverFilename = (book: Book) => {
  return `${book.hash}/cover.png`;
};
export const getConfigFilename = (book: Book) => {
  return `${book.hash}/config.json`;
};
export const isBookFile = (filename: string) => {
  return Object.values(EXTS).includes(filename.split('.').pop()!);
};
export const getBaseFilename = (filename: string) => {
  const normalizedPath = filename.replace(/\\/g, '/');
  const baseName = normalizedPath.split('/').pop()?.split('.').slice(0, -1).join('.') || '';
  return baseName;
};
export const INIT_BOOK_CONFIG: BookConfig = {
  lastUpdated: 0,
};

interface LanguageMap {
  [key: string]: string;
}

const formatLanguageMap = (x: string | LanguageMap): string => {
  if (!x) return '';
  if (typeof x === 'string') return x;
  const keys = Object.keys(x);
  return x[keys[0]!]!;
};

const listFormat = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

const formatContributors = (contributors: any) =>
  Array.isArray(contributors)
    ? listFormat.format(
        contributors.map((contributor) =>
          typeof contributor === 'string' ? contributor : formatLanguageMap(contributor?.name),
        ),
      )
    : typeof contributors === 'string'
      ? contributors
      : formatLanguageMap(contributors?.name);

export const formatAuthors = (authors: any) => formatContributors(authors);
