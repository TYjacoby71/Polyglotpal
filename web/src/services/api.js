import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 20000 });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  register: (email, password) => api.post('/auth/register', { email, password }).then(r => r.data),
  login:    (email, password) => api.post('/auth/login',    { email, password }).then(r => r.data),
};

export const userAPI = {
  getMe:        ()            => api.get('/users/me').then(r => r.data),
  updatePrefs:  (prefs)       => api.patch('/users/me', prefs).then(r => r.data),
  getStats:     ()            => api.get('/users/me/stats').then(r => r.data),
  getSRSDeck:   (lang, limit) => api.get('/users/me/srs', { params: { language: lang, limit } }).then(r => r.data),
  submitReview: (id, quality) => api.post(`/users/me/srs/${id}/review`, { quality }).then(r => r.data),
};

export const sessionAPI = {
  start: (trigger_type = 'conversation', target_language = 'es') =>
    api.post('/sessions', { trigger_type, target_language }).then(r => r.data),
  end: (id, body) => api.patch(`/sessions/${id}/end`, body).then(r => r.data),
  list: (limit = 20) => api.get('/sessions', { params: { limit } }).then(r => r.data),
};

export const conversationAPI = {
  sendTurn: ({ sessionId, userText, turnHistory }) =>
    api.post('/conversation/turn', {
      session_id: sessionId,
      user_text: userText,
      turn_history: turnHistory,
    }).then(r => r.data),

  getReceipt: (sessionId) =>
    api.post('/conversation/receipt', { session_id: sessionId }).then(r => r.data),
};
