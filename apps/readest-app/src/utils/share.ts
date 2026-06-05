import { READEST_WEB_BASE_URL, SHARE_TOKEN_LENGTH } from '@/services/constants';
import { getWebBaseUrl, getShareBaseUrl } from '@/services/environment';

export interface ShareDeepLink {
  token: string;
  // Reserved for future query params (e.g., recipient locale, share variant).
  // Currently no params are emitted, but parseShareDeepLink preserves the
  // shape so callers don't need to be updated when more arrive.
}

const TOKEN_RE = new RegExp(`^[A-Za-z0-9]{${SHARE_TOKEN_LENGTH}}$`);

const isValidToken = (raw: unknown): raw is string => typeof raw === 'string' && TOKEN_RE.test(raw);

// Canonical share URL embedded in the dialog, share sheet, and any "copy link"
// affordance. Always points at the public web target.
export const buildShareUrl = (token: string): string => `${getShareBaseUrl()}/${token}`;

// Parses both the custom-scheme and HTTPS forms used by the deeplink ingress.
//   readest://share/{token}
//   https://web.readest.com/s/{token}  (or self-hosted equivalent)
// Returns null on invalid input so callers can fall through to other parsers.
export const parseShareDeepLink = (url: string): ShareDeepLink | null => {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol === 'readest:') {
    // For readest://share/{token} the host portion holds the path segment
    // before the slash. Use pathname for the token; url.host == 'share'.
    if (parsed.host !== 'share') return null;
    const token = parsed.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    return isValidToken(token) ? { token } : null;
  }
  if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
    if (!isWebReadestHost(parsed.host)) return null;
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length !== 2 || segments[0] !== 's') return null;
    const token = segments[1]!;
    return isValidToken(token) ? { token } : null;
  }
  return null;
};

const isWebReadestHost = (host: string): boolean => {
  // Accept the configured web base URL host (self-hosted or upstream).
  try {
    const configuredHost = new URL(getWebBaseUrl()).host;
    if (host === configuredHost) return true;
  } catch {}
  // Also accept the upstream production host and *.readest.com subdomains.
  if (host === new URL(READEST_WEB_BASE_URL).host) return true;
  return host.endsWith('.readest.com');
};
