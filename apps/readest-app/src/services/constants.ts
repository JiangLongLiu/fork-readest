import { ReadSettings } from '@/types/settings';

export const LOCAL_BOOKS_SUBDIR = 'Readest/Books';
export const CLOUD_BOOKS_SUBDIR = 'Readest/Books';

export const DEFAULT_READSETTINGS: ReadSettings = {
  themeType: 'auto',
  fontFamily: '',
  fontSize: 1.0,
  wordSpacing: 0.16,
  lineSpacing: 1.5,

  sideBarWidth: '20%',
  isSideBarPinned: true,
};

export const SYSTEM_SETTINGS_VERSION = 1;
