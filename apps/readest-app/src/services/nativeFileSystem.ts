import {
  exists,
  mkdir,
  readTextFile,
  readFile,
  writeTextFile,
  writeFile,
  readDir,
  remove,
  BaseDirectory,
  copyFile,
} from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';

import { FileSystem, BaseDir } from '../types/system';
import { LOCAL_BOOKS_SUBDIR } from './constants';

export const resolvePath = (
  fp: string,
  base: BaseDir,
): { baseDir: number; base: BaseDir; fp: string } => {
  switch (base) {
    case 'Settings':
      return { baseDir: BaseDirectory.AppConfig, fp, base };
    case 'Data':
      return { baseDir: BaseDirectory.AppData, fp, base };
    case 'Cache':
      return { baseDir: BaseDirectory.AppCache, fp, base };
    case 'Log':
      return { baseDir: BaseDirectory.AppLog, fp, base };
    case 'Books':
      return {
        baseDir: BaseDirectory.Document,
        fp: `${LOCAL_BOOKS_SUBDIR}/${fp}`,
        base,
      };
    default:
      return {
        baseDir: BaseDirectory.Temp,
        fp,
        base,
      };
  }
};

export const nativeFileSystem: FileSystem = {
  getURL(path: string) {
    return convertFileSrc(path);
  },
  async copyFile(srcPath: string, dstPath: string, base: BaseDir) {
    const { fp, baseDir } = resolvePath(dstPath, base);
    await copyFile(srcPath, fp, base && { toPathBaseDir: baseDir });
  },
  async readFile(path: string, base: BaseDir, mode: 'text' | 'binary') {
    const { fp, baseDir } = resolvePath(path, base);

    return mode === 'text'
      ? (readTextFile(fp, base && { baseDir }) as Promise<string>)
      : ((await readFile(fp, base && { baseDir })).buffer as ArrayBuffer);
  },
  async writeFile(path: string, base: BaseDir, content: string | ArrayBuffer) {
    const { fp, baseDir } = resolvePath(path, base);

    return typeof content === 'string'
      ? writeTextFile(fp, content, base && { baseDir })
      : writeFile(fp, new Uint8Array(content), base && { baseDir });
  },
  async removeFile(path: string, base: BaseDir) {
    const { fp, baseDir } = resolvePath(path, base);

    return remove(fp, base && { baseDir });
  },
  async createDir(path: string, base: BaseDir, recursive = false) {
    const { fp, baseDir } = resolvePath(path, base);

    await mkdir(fp, base && { baseDir, recursive });
  },
  async removeDir(path: string, base: BaseDir, recursive = false) {
    const { fp, baseDir } = resolvePath(path, base);

    await remove(fp, base && { baseDir, recursive });
  },
  async readDir(path: string, base: BaseDir) {
    const { fp, baseDir } = resolvePath(path, base);

    const list = await readDir(fp, base && { baseDir });
    return list.map((entity) => {
      return {
        path: entity.name,
        isDir: entity.isDirectory,
      };
    });
  },
  async exists(path: string, base: BaseDir) {
    const { fp, baseDir } = resolvePath(path, base);

    try {
      const res = await exists(fp, base && { baseDir });
      return res;
    } catch {
      return false;
    }
  },
};
