export type BookFormat = 'EPUB' | 'PDF';

export interface Book {
  id: string;
  format: BookFormat;
  title: string;
  author: string;
  lastUpdated: number;
  isRemoved?: boolean;
  coverImageUrl?: string | null;
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

export interface BookConfig {
  lastUpdated: number;
  remoteProgress: number;
  localProgress: number;
  bookmarks: BookNote[];
  annotations: BookNote[];
  removedNotesTimestamps?: Record<string, number>;
}
