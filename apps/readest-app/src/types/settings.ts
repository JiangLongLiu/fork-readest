import { ViewSettings } from './book';

export type ThemeType = 'light' | 'dark' | 'auto';

export interface ReadSettings {
  sideBarWidth: string;
  isSideBarPinned: boolean;
  autohideCursor: boolean;
}

export interface SystemSettings {
  version: number;
  localBooksDir: string;

  globalReadSettings: ReadSettings;
  globalViewSettings: ViewSettings;
}
