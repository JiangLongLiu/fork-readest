import { getMatches } from '@tauri-apps/plugin-cli';

declare global {
  interface Window {
    TAURI_CLI_ARGS?: string[];
  }
}

interface CliArgument {
  value: string;
  occurrences: number;
}

const parseGlobalArgs = () => {
  return window.TAURI_CLI_ARGS;
};

const parseCLIArgs = async () => {
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
  let files = parseGlobalArgs();
  if (!files) {
    files = await parseCLIArgs();
  }
  return files;
};
