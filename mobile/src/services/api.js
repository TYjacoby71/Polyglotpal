import axios from 'axios';
import { storage } from '../store/storage';

const API_URL = __DEV__ ? 'http://localhost:3000' : 'https://api.polyglotpal.app';

const api = axios.create({ baseURL: API_URL, timeout: 15000 });

// ── Auth token injection ──────────────────────────────────────────────────
api.interceptors.request.use(config => {
  const token = storage.getString('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (email, password) =>
    api.post('/auth/register', { email, password }).then(r => r.data),
  login: (email, password) =>
    api.post('/auth/login', { email, password }).then(r => r.data),
};

// ── User ──────────────────────────────────────────────────────────────────
export const userAPI = {
  getMe: () => api.get('/users/me').then(r => r.data),
  updatePrefs: (prefs) => api.patch('/users/me', prefs).then(r => r.data),
  getStats: () => api.get('/users/me/stats').then(r => r.data),
  getSRSDeck: (language, limit = 5) =>
    api.get('/users/me/srs', { params: { language, limit } }).then(r => r.data),
  submitReview: (itemId, quality) =>
    api.post(`/users/me/srs/${itemId}/review`, { quality }).then(r => r.data),
};

// ── Sessions ──────────────────────────────────────────────────────────────
export const sessionAPI = {
  start: (trigger_type = 'conversation', target_language = 'es') =>
    api.post('/sessions', { trigger_type, target_language }).then(r => r.data),
  end: (sessionId, { wins, summary_text, target_language_ratio_avg }) =>
    api.patch(`/sessions/${sessionId}/end`, { wins, summary_text, target_language_ratio_avg })
      .then(r => r.data),
  list: (limit = 20) =>
    api.get('/sessions', { params: { limit } }).then(r => r.data),
  get: (sessionId) =>
    api.get(`/sessions/${sessionId}`).then(r => r.data),
};

// ── Conversation ──────────────────────────────────────────────────────────
export const conversationAPI = {
  sendTurn: ({ sessionId, userText, turnHistory }) =>
    api.post('/conversation/turn', {
      session_id: sessionId,
      user_text: userText,
      turn_history: turnHistory,
    }).then(r => r.data),

  transcribeAudio: async (audioUri) => {
    const form = new FormData();
    form.append('audio', { uri: audioUri, name: 'audio.m4a', type: 'audio/m4a' });
    return api.post('/conversation/asr', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },

  getReceipt: (sessionId) =>
    api.post('/conversation/receipt', { session_id: sessionId }).then(r => r.data),
};

// ── Notifications ─────────────────────────────────────────────────────────
export const notificationAPI = {
  recordEvent: (notifId, userAction) =>
    api.post('/notifications/event', { notif_id: notifId, user_action: userAction })
      .then(r => r.data),
  getNext: () =>
    api.get('/notifications/next').then(r => r.data),
  getHistory: () =>
    api.get('/notifications/history').then(r => r.data),
};
