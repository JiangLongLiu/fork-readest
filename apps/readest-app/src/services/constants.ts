import { BookFont, BookLayout, BookStyle } from '@/types/book';
import { ReadSettings } from '@/types/settings';

export const LOCAL_BOOKS_SUBDIR = 'Readest/Books';
export const CLOUD_BOOKS_SUBDIR = 'Readest/Books';

export const DEFAULT_READSETTINGS: ReadSettings = {
  sideBarWidth: '25%',
  isSideBarPinned: true,
  autohideCursor: true,
};

export const DEFAULT_BOOK_FONT: BookFont = {
  serif: 'Serif 12',
  sansSerif: 'Sans 12',
  monospace: 'Monospace 12',
  defaultFont: 'serif',
  defaultSize: 16,
  minimumSize: 8,
  fontWeight: 400,
};

export const DEFAULT_BOOK_LAYOUT: BookLayout = {
  gap: 0.05,
  scrolled: false,
  maxColumnCount: 2,
  maxInlineSize: 720,
  maxBlockSize: 1440,
  animated: true,
};

export const DEFAULT_BOOK_STYLE: BookStyle = {
  zoomLevel: 100,
  lineHeight: 1.5,
  justify: true,
  hyphenate: true,
  invert: false,
  theme: 'light',
  overrideFont: false,
  userStylesheet: '',
};

export const SYSTEM_SETTINGS_VERSION = 1;
