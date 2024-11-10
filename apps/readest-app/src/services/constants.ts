import { BookFont, BookLayout, BookStyle } from '@/types/book';
import { ReadSettings } from '@/types/settings';

export const LOCAL_BOOKS_SUBDIR = 'Readest/Books';
export const CLOUD_BOOKS_SUBDIR = 'Readest/Books';

export const DEFAULT_READSETTINGS: ReadSettings = {
  sideBarWidth: '25%',
  isSideBarPinned: true,
  sideBarTab: 'toc',
  notebookWidth: '25%',
  isNotebookPinned: false,
  autohideCursor: true,

  highlightStyle: 'highlight',
  highlightStyles: {
    highlight: 'yellow',
    underline: 'green',
    squiggly: 'blue',
  },
};

export const DEFAULT_BOOK_FONT: BookFont = {
  serifFont: 'Literata',
  sansSerifFont: 'Roboto',
  monospaceFont: 'Consolas',
  defaultFont: 'Serif',
  defaultFontSize: 16,
  minimumFontSize: 8,
  fontWeight: 400,
};

export const DEFAULT_BOOK_LAYOUT: BookLayout = {
  marginPx: 44,
  gapPercent: 5,
  scrolled: false,
  maxColumnCount: 2,
  maxInlineSize: 720,
  maxBlockSize: 1440,
  animated: true,
};

export const DEFAULT_BOOK_STYLE: BookStyle = {
  zoomLevel: 100,
  lineHeight: 1.6,
  fullJustification: true,
  hyphenation: true,
  invert: false,
  theme: 'light',
  overrideFont: false,
  userStylesheet: '',
};

export const SYSTEM_SETTINGS_VERSION = 1;

export const SERIF_FONTS = [
  'Bitter',
  'Literata',
  'Merriweather',
  'Vollkorn',
  'Georgia',
  'Times New Roman',
];

export const SANS_SERIF_FONTS = ['Roboto', 'Noto Sans', 'Open Sans', 'Helvetica', 'Arial'];

export const MONOSPACE_FONTS = ['Fira Code', 'Lucida Console', 'Consolas', 'Courier New'];

export const ONE_COLUMN_MAX_INLINE_SIZE = 9999;
