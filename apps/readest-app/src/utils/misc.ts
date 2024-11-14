import { md5 } from 'js-md5';

export const uniqueId = () => Math.random().toString(36).substring(2, 9);

export const getContentMd5 = (content: unknown) => md5(JSON.stringify(content));

export const makeSafeFilename = (filename: string, replacement = '_') => {
  // Windows restricted characters + control characters and reserved names
  const unsafeCharacters = /[<>:"\/\\|?*\x00-\x1F]/g;
  const reservedFilenames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  const maxFilenameLength = 255;

  let safeName = filename.replace(unsafeCharacters, replacement);

  if (reservedFilenames.test(safeName)) {
    safeName = `${safeName}${replacement}`;
  }

  if (safeName.length > maxFilenameLength) {
    safeName = safeName.substring(0, maxFilenameLength);
  }

  return safeName.trim();
};
