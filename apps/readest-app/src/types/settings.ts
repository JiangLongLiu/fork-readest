import { HighlightColor, HighlightStyle, ViewSettings } from './book';

export type ThemeType = 'light' | 'dark' | 'auto';

export interface ReadSettings {
  sideBarWidth: string;
  isSideBarPinned: boolean;
  notebookWidth: string;
  isNotebookPinned: boolean;
  autohideCursor: boolean;

  highlightStyle: HighlightStyle;
  highlightStyles: Record<HighlightStyle, HighlightColor>;
}

export interface SystemSettings {
  version: number;
  localBooksDir: string;

  globalReadSettings: ReadSettings;
  globalViewSettings: ViewSettings;
}
