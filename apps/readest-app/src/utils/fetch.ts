import { getAccessToken } from './access';
import { supabase } from '@/utils/supabase';

export const fetchWithTimeout = (url: string, options: RequestInit = {}, timeout = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort('Request timed out'), timeout);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => clearTimeout(id));
};

export const fetchWithAuth = async (
  url: string,
  options: RequestInit,
  _retryCount = 0,
): Promise<Response> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(url, { ...options, headers });

  // If 401 and haven't retried yet, try to refresh the token and retry
  if (response.status === 401 && _retryCount === 0) {
    try {
      const { data } = await supabase.auth.refreshSession();
      if (data?.session?.access_token && data.session.access_token !== token) {
        localStorage.setItem('token', data.session.access_token);
        if (data.session.refresh_token) {
          localStorage.setItem('refresh_token', data.session.refresh_token);
        }
        return fetchWithAuth(url, options, 1);
      }
    } catch {
      // Refresh failed, fall through to error handling
    }
  }

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // Response body is not JSON
    }
    console.error('Error:', errorMessage);
    throw new Error(errorMessage || 'Request failed');
  }

  return response;
};
