import { getMatches } from '@tauri-apps/plugin-cli';

declare global {
  interface Window {
    OPEN_WITH_FILES?: string[];
  }
}

interface CliArgument {
  value: string;
  occurrences: number;
}

const parseWindowOpenWithFiles = () => {
  return window.OPEN_WITH_FILES;
};

const parseCLIOpenWithFiles = async () => {
  const matches = await getMatches();
  const args = matches?.args;
  const files: string[] = [];
  if (args) {
    for (const name of ['file1', 'file2', 'file3', 'file4']) {
      const arg = args[name] as CliArgument;
      if (arg && arg.occurrences > 0) {
        files.push(arg.value);
      }
    }
  }

  return files;
};

export const parseOpenWithFiles = async () => {
  let files = parseWindowOpenWithFiles();
  if (!files) {
    files = await parseCLIOpenWithFiles();
  }
  return files;
};
