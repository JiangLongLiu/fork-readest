export type ThemeType = 'light' | 'dark' | 'auto';

export interface ReadSettings {
  themeType: ThemeType;
  fontFamily: string;
  fontSize: number;
  wordSpacing: number;
  lineSpacing: number;

  sideBarWidth: string;
  isSideBarPinned: boolean;
}

export interface SystemSettings {
  localBooksDir: string;
  globalReadSettings: ReadSettings;
}
