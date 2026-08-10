import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Backend base URL. On Android emulator use 10.0.2.2 to reach host localhost.
const DEFAULT_ANDROID = 'http://10.0.2.2:12000';
const DEFAULT_OTHER = 'http://localhost:12000';
const ENV_URL = Constants.expoConfig?.extra?.apiBaseUrl;

export const API_BASE =
  ENV_URL || (Platform.OS === 'android' ? DEFAULT_ANDROID : DEFAULT_OTHER);

const TOKEN_KEY = 'dp_token';

let token: string | null = null;

export async function loadToken(): Promise<string | null> {
  token = await AsyncStorage.getItem(TOKEN_KEY);
  return token;
}

export function setToken(t: string | null) {
  token = t;
  if (t) AsyncStorage.setItem(TOKEN_KEY, t);
  else AsyncStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return token;
}

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(message: string, status: number, body: any) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function call<T = any>(
  method: string,
  path: string,
  opts: { body?: any; auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.auth !== false && token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    throw new ApiError(json.error || 'HTTP ' + res.status, res.status, json);
  }
  return json.data as T;
}

export const API = {
  auth: {
    register: (b: any) => call('POST', '/api/auth/register', { body: b, auth: false }),
    login: (b: any) => call('POST', '/api/auth/login', { body: b, auth: false }),
    me: () => call('GET', '/api/auth/me'),
    logout: () => call('POST', '/api/auth/logout'),
  },
  user: {
    updateProfile: (name: string) => call('PUT', '/api/user/profile', { body: { name } }),
    changePassword: (b: any) => call('POST', '/api/user/change-password', { body: b }),
  },
  points: {
    balance: () => call('GET', '/api/points/balance'),
    transactions: (limit = 100, offset = 0, type = '') =>
      call('GET', `/api/points/transactions?limit=${limit}&offset=${offset}&type=${type}`),
  },
  campaigns: {
    list: () => call('GET', '/api/campaigns'),
    get: (id: string) => call('GET', '/api/campaigns/' + id),
    click: (id: string) => call('POST', `/api/campaigns/${id}/click`),
    myActive: () => call('GET', '/api/campaigns/my/active'),
    myDetail: (id: string) => call('GET', '/api/campaigns/my/' + id),
  },
  withdrawals: {
    denominations: () => call('GET', '/api/withdrawals/denominations'),
    create: (b: any) => call('POST', '/api/withdrawals', { body: b }),
    list: (limit = 50, offset = 0) => call('GET', `/api/withdrawals?limit=${limit}&offset=${offset}`),
  },
  referrals: { list: () => call('GET', '/api/referrals') },
  notifications: {
    list: () => call('GET', '/api/notifications'),
    markRead: (id: string) => call('POST', '/api/notifications/' + id + '/read'),
  },
};
