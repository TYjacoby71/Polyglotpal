import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { userAPI } from '../services/api';
import styles from './SRSPage.module.css';

export function SRSPage() {
  const navigate = useNavigate();
  const [items, setItems]     = useState([]);
  const [current, setCurrent] = useState(0);
  const [revealed, setReveal] = useState(false);
  const [done, setDone]       = useState(false);
  const [score, setScore]     = useState({ correct: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userAPI.getSRSDeck('es', 10)
      .then(d => { setItems(d.items ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const speak = (word) => {
    if (!window.speechSynthesis) return;
    const utt = new SpeechSynthesisUtterance(word);
    const voice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('es'));
    if (voice) utt.voice = voice;
    utt.lang = 'es-ES';
    utt.rate = 0.85;
    window.speechSynthesis.speak(utt);
  };

  const rate = async (quality) => {
    const item = items[current];
    await userAPI.submitReview(item.id, quality).catch(() => {});
    setScore(s => ({ correct: s.correct + (quality >= 3 ? 1 : 0), total: s.total + 1 }));
    const next = current + 1;
    if (next >= items.length) { setDone(true); } else { setCurrent(next); setReveal(false); }
  };

  if (loading) return (
    <Layout>
      <div className={styles.center}>
        <div className={styles.spinner} />
      </div>
    </Layout>
  );

  if (items.length === 0) return (
    <Layout>
      <div className={styles.center}>
        <span className={styles.bigEmoji}>🎉</span>
        <h2 className={styles.doneTitle}>All caught up!</h2>
        <p className={styles.doneText}>No words due for review today.</p>
        <button className={styles.backBtn} onClick={() => navigate('/')}>Back to Practice</button>
      </div>
    </Layout>
  );

  if (done) return (
    <Layout>
      <div className={styles.center}>
        <span className={styles.bigEmoji}>🎯</span>
        <h2 className={styles.doneTitle}>Review complete!</h2>
        <p className={styles.doneScore}>{score.correct} / {score.total} correct</p>
        <button className={styles.backBtn} onClick={() => navigate('/')}>Back to Practice</button>
      </div>
    </Layout>
  );

  const item = items[current];
  const progress = ((current) / items.length) * 100;

  return (
    <Layout>
      <div className={styles.page + ' fade-up'}>
        <header className={styles.header}>
          <h1 className={styles.title}>Flashcards</h1>
          <span className={styles.counter}>{current + 1} / {items.length}</span>
        </header>

        {/* Progress */}
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>

        {/* Card */}
        <div className={styles.card}>
          <div className={styles.cardWord}>{item.item}</div>
          {item.example_sentence && (
            <p className={styles.cardExample}>"{item.example_sentence}"</p>
          )}
          <button className={styles.speakBtn} onClick={() => speak(item.item)}>
            🔊 Hear it
          </button>

          {!revealed ? (
            <button className={styles.revealBtn} onClick={() => setReveal(true)}>
              Reveal meaning
            </button>
          ) : (
            <div className={styles.gloss + ' fade-in'}>{item.gloss}</div>
          )}
        </div>

        {/* Rating */}
        {revealed && (
          <div className={styles.ratingSection + ' fade-up'}>
            <p className={styles.ratingLabel}>How well did you know it?</p>
            <div className={styles.ratingRow}>
              <button className={`${styles.rateBtn} ${styles.nope}`}  onClick={() => rate(1)}>❌<span>Nope</span></button>
              <button className={`${styles.rateBtn} ${styles.fuzzy}`} onClick={() => rate(3)}>😬<span>Fuzzy</span></button>
              <button className={`${styles.rateBtn} ${styles.gotit}`} onClick={() => rate(5)}>✅<span>Got it</span></button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
