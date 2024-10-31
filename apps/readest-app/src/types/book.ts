export type BookFormat = 'EPUB' | 'PDF' | 'MOBI' | 'CBZ' | 'FB2' | 'FBZ';

export interface Book {
  hash: string;
  format: BookFormat;
  title: string;
  author: string;
  group?: string;
  tags?: string[];
  lastUpdated: number;
  isRemoved?: boolean;
  coverImageUrl?: string | null;
}

export interface PageInfo {
  current: number;
  next?: number;
  total: number;
}

export interface BookNote {
  cfi: string;
  start: string;
  end: string;
  page: number;
  noteText?: string;
  annotation?: string;
  lastModified: number;
  removalTimestamp?: number;
}

export interface BookLayout {
  gap: number;
  scrolled: boolean;
  maxColumnCount: number;
  maxInlineSize: number;
  maxBlockSize: number;
  animated: boolean;
}

export interface BookStyle {
  zoomLevel: number;
  lineHeight: number;
  justify: boolean;
  hyphenate: boolean;
  invert: boolean;
  theme: string;
  overrideFont: boolean;
  userStylesheet: string;
}

export interface BookFont {
  serif: string;
  sansSerif: string;
  monospace: string;
  defaultFont: string;
  defaultSize: number;
  minimumSize: number;
  fontWeight: number;
}

export interface ViewSettings extends BookLayout, BookStyle, BookFont {}

export interface BookConfig {
  lastUpdated: number;
  progress?: number;
  location?: string;
  href?: string;
  chapter?: string;
  section?: PageInfo;
  pageinfo?: PageInfo;

  bookmarks?: BookNote[];
  annotations?: BookNote[];
  removedNotesTimestamps?: Record<string, number>;

  viewSettings?: Partial<ViewSettings>;
}

export interface BooksGroup {
  name: string;
  books: Book[];
  lastUpdated: number;
}
export interface BookContent {
  book: Book;
  file: File;
  config: BookConfig;
}
