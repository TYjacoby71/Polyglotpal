import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode]       = useState('login');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in both fields.'); return; }
    if (mode === 'register' && password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      mode === 'login' ? await login(email, password) : await register(email, password);
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.error ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.bg} />
      <div className={styles.card + ' fade-up'}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>P</span>
          <span>PolyglotPal</span>
        </div>
        <p className={styles.tagline}>Chat your way to fluency</p>

        <div className={styles.toggle}>
          <button className={mode === 'login' ? styles.toggleActive : styles.toggleBtn} onClick={() => setMode('login')}>Log in</button>
          <button className={mode === 'register' ? styles.toggleActive : styles.toggleBtn} onClick={() => setMode('register')}>Sign up</button>
        </div>

        <form onSubmit={submit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <label className={styles.label}>Email</label>
          <input className={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
          <label className={styles.label}>Password</label>
          <input className={styles.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'} />
          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? <span className={styles.spinner} /> : (mode === 'login' ? 'Log in' : 'Create account')}
          </button>
        </form>
      </div>
    </div>
  );
}
