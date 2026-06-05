import { jwtDecode } from 'jwt-decode';
import { supabase } from '@/utils/supabase';
import { UserPlan } from '@/types/quota';
import { DEFAULT_DAILY_TRANSLATION_QUOTA, DEFAULT_STORAGE_QUOTA } from '@/services/constants';
import { isWebAppPlatform } from '@/services/environment';
import { getDailyUsage } from '@/services/translators/utils';
import { getRuntimeConfig } from '@/services/runtimeConfig';

interface Token {
  plan: UserPlan;
  storage_usage_bytes: number;
  storage_purchased_bytes: number;
  [key: string]: string | number;
}

export const getSubscriptionPlan = (token: string): UserPlan => {
  const data = jwtDecode<Token>(token) || {};
  return data['plan'] || 'free';
};

export const getUserProfilePlan = (token: string): UserPlan => {
  const data = jwtDecode<Token>(token) || {};
  let plan = data['plan'] || 'free';
  if (plan === 'free') {
    const purchasedQuota = data['storage_purchased_bytes'] || 0;
    if (purchasedQuota > 0) {
      plan = 'purchase';
    }
  }
  return plan;
};

/**
 * Plans that include the "Send to Readest via email" feature: Plus,
 * Pro, and Lifetime (`purchase`). Free users see an upgrade card on
 * the client and get a 403 from the server endpoints that allocate /
 * rotate the address, plus a bounce from the inbound email Worker.
 *
 * Other Send channels (in-app `/send` page, mobile share-sheet, browser
 * extension) stay open to free users — the gate is the personal email
 * inbox only.
 */
export const EMAIL_IN_PLANS: readonly UserPlan[] = ['plus', 'pro', 'purchase'];

export const isEmailInPlan = (plan: UserPlan): boolean =>
  (EMAIL_IN_PLANS as readonly UserPlan[]).includes(plan);

export const STORAGE_QUOTA_GRACE_BYTES = 10 * 1024 * 1024; // 10 MB grace

export const getStoragePlanData = (token: string) => {
  const data = jwtDecode<Token>(token) || {};
  const plan = data['plan'] || 'free';
  const usage = data['storage_usage_bytes'] || 0;
  const purchasedQuota = data['storage_purchased_bytes'] || 0;
  const runtimeConfig = getRuntimeConfig();
  const fixedQuota =
    runtimeConfig?.storageFixedQuota ?? parseInt(process.env['STORAGE_FIXED_QUOTA'] ?? '0');
  const planQuota = fixedQuota || DEFAULT_STORAGE_QUOTA[plan] || DEFAULT_STORAGE_QUOTA['free'];
  const quota = planQuota + purchasedQuota;

  return {
    plan,
    usage,
    quota,
  };
};

export const getTranslationQuota = (plan: UserPlan): number => {
  const runtimeConfig = getRuntimeConfig();
  const fixedQuota =
    runtimeConfig?.translationFixedQuota ?? parseInt(process.env['TRANSLATION_FIXED_QUOTA'] ?? '0');
  return (
    fixedQuota || DEFAULT_DAILY_TRANSLATION_QUOTA[plan] || DEFAULT_DAILY_TRANSLATION_QUOTA['free']
  );
};

export const getTranslationPlanData = (token: string) => {
  const data = jwtDecode<Token>(token) || {};
  const plan: UserPlan = data['plan'] || 'free';
  const usage = getDailyUsage() || 0;
  const quota = getTranslationQuota(plan);

  return {
    plan,
    usage,
    quota,
  };
};

export const getDailyTranslationPlanData = (token: string) => {
  const data = jwtDecode<Token>(token) || {};
  const plan = data['plan'] || 'free';
  const quota = getTranslationQuota(plan);

  return {
    plan,
    quota,
  };
};

export const getAccessToken = async (): Promise<string | null> => {
  // On web, use localStorage which is the single source of truth
  // (avoids issues with multiple Supabase instances in app/pages routes).
  if (isWebAppPlatform()) {
    return localStorage.getItem('token') ?? null;
  }
  // On Tauri, prefer the Supabase session (which auto-refreshes tokens),
  // then fall back to localStorage for resilience after client re-init.
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      // Keep localStorage in sync so other code paths see the latest token
      const current = localStorage.getItem('token');
      if (current !== data.session.access_token) {
        localStorage.setItem('token', data.session.access_token);
        if (data.session.refresh_token) {
          localStorage.setItem('refresh_token', data.session.refresh_token);
        }
      }
      return data.session.access_token;
    }
  } catch {
    // Supabase session unavailable — fall through to localStorage
  }
  return localStorage.getItem('token') ?? null;
};

export const getUserID = async (): Promise<string | null> => {
  if (isWebAppPlatform()) {
    const user = localStorage.getItem('user') ?? '{}';
    return JSON.parse(user).id ?? null;
  }
  // On Tauri, try Supabase session first, fall back to localStorage
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user?.id) return data.session.user.id;
  } catch {
    // Fall through
  }
  try {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      return JSON.parse(userJson).id ?? null;
    }
  } catch {
    // ignore
  }
  return null;
};

export const validateUserAndToken = async (authHeader: string | null | undefined) => {
  if (!authHeader) return {};

  const token = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return {};
  return { user, token };
};
