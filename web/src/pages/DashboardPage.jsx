import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { userAPI, sessionAPI } from '../services/api';
import styles from './DashboardPage.module.css';

const FOCUS = ['Open', 'Travel', 'Food', 'Work', 'Slang'];
const CEFR_COLOR = { A1: '#94A3B8', A2: '#60A5FA', B1: '#34D399', B2: '#A78BFA', C1: '#F59E0B', C2: '#F87171' };

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats]   = useState(null);
  const [srs, setSrs]       = useState([]);
  const [focus, setFocus]   = useState('Open');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    Promise.all([userAPI.getStats(), userAPI.getSRSDeck('es', 3)])
      .then(([s, d]) => { setStats(s); setSrs(d.items ?? []); })
      .catch(() => {});
  }, []);

  const startSession = async () => {
    setStarting(true);
    try {
      const { session } = await sessionAPI.start('conversation', 'es');
      navigate(`/conversation/${session.id}`, { state: { focus } });
    } catch { setStarting(false); }
  };

  const skill = stats?.skills?.[0];

  return (
    <Layout>
      <div className={styles.page + ' fade-up'}>

        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Practice</h1>
            <p className={styles.subtitle}>Ready to chat in Spanish?</p>
          </div>
          {skill && (
            <div className={styles.levelBadge} style={{ background: CEFR_COLOR[skill.cefr_estimate] + '22', color: CEFR_COLOR[skill.cefr_estimate] }}>
              {skill.cefr_estimate} · ES
            </div>
          )}
        </header>

        {/* Stats row */}
        <div className={styles.statsRow}>
          <StatCard icon="🔥" num={stats?.streak_days ?? 0}    label="day streak" />
          <StatCard icon="⏱️" num={stats?.weekly_minutes ?? 0} label="min this week" />
          <StatCard icon="💬" num={stats?.total_sessions ?? 0} label="sessions" />
        </div>

        {/* Focus selector */}
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Today's focus</h2>
          <div className={styles.chips}>
            {FOCUS.map(f => (
              <button key={f} className={focus === f ? styles.chipActive : styles.chip} onClick={() => setFocus(f)}>
                {f}
              </button>
            ))}
          </div>
        </section>

        {/* Talk Now */}
        <button className={styles.talkBtn} onClick={startSession} disabled={starting}>
          {starting
            ? <span className={styles.btnSpinner} />
            : <><span className={styles.talkIcon}>🎙️</span> Talk Now</>
          }
        </button>

        {/* SRS deck */}
        {srs.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionRow}>
              <h2 className={styles.sectionLabel}>Review today</h2>
              <button className={styles.seeAll} onClick={() => navigate('/srs')}>See all →</button>
            </div>
            <div className={styles.srsGrid}>
              {srs.map(item => (
                <div key={item.id} className={styles.srsCard} onClick={() => navigate('/srs')}>
                  <span className={styles.srsWord}>{item.item}</span>
                  <span className={styles.srsGloss}>{item.gloss}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Skill bars */}
        {skill && (
          <section className={styles.section}>
            <h2 className={styles.sectionLabel}>Your progress</h2>
            <div className={styles.skillCard}>
              <SkillBar label="Comprehension" value={skill.comprehension_score ?? 0.5} color={CEFR_COLOR[skill.cefr_estimate]} />
              <SkillBar label="Production"    value={skill.production_score ?? 0.5}    color={CEFR_COLOR[skill.cefr_estimate]} />
            </div>
          </section>
        )}

      </div>
    </Layout>
  );
}

function StatCard({ icon, num, label }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statIcon}>{icon}</span>
      <span className={styles.statNum}>{num}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function SkillBar({ label, value, color }) {
  return (
    <div className={styles.barRow}>
      <span className={styles.barLabel}>{label}</span>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${Math.round(value * 100)}%`, background: color }} />
      </div>
      <span className={styles.barPct}>{Math.round(value * 100)}%</span>
    </div>
  );
}
