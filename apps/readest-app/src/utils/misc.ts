import { md5 } from 'js-md5';

export const uniqueId = () => Math.random().toString(36).substring(2, 9);

export const getContentMd5 = (content: unknown) => md5(JSON.stringify(content));
