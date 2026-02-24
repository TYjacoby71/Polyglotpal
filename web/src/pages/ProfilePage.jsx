import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { userAPI } from '../services/api';
import { useAuth } from '../store/AuthContext';
import styles from './ProfilePage.module.css';

const INTENSITY = [
  { key: 'low',    label: 'Less corrections',    desc: 'Mostly recasts, rarely explicit' },
  { key: 'medium', label: 'Balanced (default)',   desc: 'Mix of all three modes' },
  { key: 'high',   label: 'More corrections',     desc: 'Push me harder' },
];

const NOTIF_FREQ = [
  { key: 'daily',        label: 'Once a day' },
  { key: 'three_weekly', label: '3× a week' },
  { key: 'weekdays',     label: 'Weekdays only' },
];

export function ProfilePage() {
  const { user } = useAuth();
  const [stats, setStats]           = useState(null);
  const [intensity, setIntensity]   = useState('medium');
  const [transcripts, setTranscripts] = useState(false);
  const [notifFreq, setNotifFreq]   = useState('daily');
  const [saved, setSaved]           = useState(false);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    userAPI.getStats().then(setStats).catch(() => {});
    userAPI.getMe().then(u => {
      setIntensity(u.correction_intensity ?? 'medium');
      setTranscripts(u.store_transcripts ?? false);
      setNotifFreq(u.notif_preferences?.frequency ?? 'daily');
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await userAPI.updatePrefs({
        correction_intensity: intensity,
        store_transcripts: transcripts,
        notif_preferences: { frequency: notifFreq },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const skill = stats?.skills?.[0];

  return (
    <Layout>
      <div className={styles.page + ' fade-up'}>
        <header className={styles.header}>
          <h1 className={styles.title}>Profile</h1>
          <p className={styles.email}>{user?.email}</p>
        </header>

        {/* Stats */}
        {stats && (
          <div className={styles.statsRow}>
            <Stat num={stats.streak_days}    label="day streak 🔥" />
            <Stat num={stats.weekly_minutes} label="min this week ⏱️" />
            <Stat num={stats.total_sessions} label="sessions 💬" />
          </div>
        )}

        {/* Skill bars */}
        {skill && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Your Spanish level: {skill.cefr_estimate}</h2>
            <div className={styles.card}>
              <Bar label="Comprehension" value={skill.comprehension_score} />
              <Bar label="Production"    value={skill.production_score} />
            </div>
          </section>
        )}

        {/* Correction style */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Correction style</h2>
          <div className={styles.card}>
            {INTENSITY.map(o => (
              <label key={o.key} className={`${styles.option} ${intensity === o.key ? styles.optionActive : ''}`}>
                <input type="radio" name="intensity" value={o.key} checked={intensity === o.key} onChange={() => setIntensity(o.key)} className={styles.radio} />
                <div>
                  <div className={styles.optionLabel}>{o.label}</div>
                  <div className={styles.optionDesc}>{o.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Notifications */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Notification frequency</h2>
          <div className={styles.card}>
            {NOTIF_FREQ.map(o => (
              <label key={o.key} className={`${styles.option} ${notifFreq === o.key ? styles.optionActive : ''}`}>
                <input type="radio" name="notifFreq" value={o.key} checked={notifFreq === o.key} onChange={() => setNotifFreq(o.key)} className={styles.radio} />
                <div className={styles.optionLabel}>{o.label}</div>
              </label>
            ))}
          </div>
        </section>

        {/* Privacy */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Privacy</h2>
          <div className={styles.card}>
            <label className={styles.toggleRow}>
              <div>
                <div className={styles.optionLabel}>Store conversation transcripts</div>
                <div className={styles.optionDesc}>Off by default — only structured signals saved</div>
              </div>
              <div className={`${styles.toggle} ${transcripts ? styles.toggleOn : ''}`} onClick={() => setTranscripts(!transcripts)}>
                <div className={styles.toggleThumb} />
              </div>
            </label>
          </div>
        </section>

        <button className={styles.saveBtn} onClick={save} disabled={saving}>
          {saving ? <span className={styles.spinner} /> : saved ? '✓ Saved!' : 'Save preferences'}
        </button>
      </div>
    </Layout>
  );
}

function Stat({ num, label }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statNum}>{num ?? 0}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function Bar({ label, value }) {
  return (
    <div className={styles.barRow}>
      <span className={styles.barLabel}>{label}</span>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${Math.round((value ?? 0.5) * 100)}%` }} />
      </div>
      <span className={styles.barPct}>{Math.round((value ?? 0.5) * 100)}%</span>
    </div>
  );
}
