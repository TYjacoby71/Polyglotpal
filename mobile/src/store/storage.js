import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV({ id: 'polyglotpal' });

export const authStorage = {
  getToken: () => storage.getString('auth_token') ?? null,
  setToken: (token) => storage.set('auth_token', token),
  clearToken: () => storage.delete('auth_token'),

  getUser: () => {
    const raw = storage.getString('current_user');
    return raw ? JSON.parse(raw) : null;
  },
  setUser: (user) => storage.set('current_user', JSON.stringify(user)),
  clearUser: () => storage.delete('current_user'),

  clear: () => {
    storage.delete('auth_token');
    storage.delete('current_user');
  },
};
