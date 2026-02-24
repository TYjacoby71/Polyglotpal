import React from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import styles from './ReceiptPage.module.css';

export function ReceiptPage() {
  const { sessionId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const receipt = state?.receipt ?? {};
  const { wins = [], top_corrections = [], summary = 'Great session!', vocab = [] } = receipt;

  return (
    <Layout>
      <div className={styles.page + ' fade-up'}>
        <div className={styles.hero}>
          <span className={styles.heroEmoji}>🎉</span>
          <h1 className={styles.heroTitle}>Session done</h1>
          <p className={styles.heroSummary}>{summary}</p>
        </div>

        <div className={styles.grid}>
          {/* Wins */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>✅ Wins</h2>
            <ul className={styles.list}>
              {wins.map((w, i) => <li key={i} className={styles.listItem}>{w}</li>)}
            </ul>
          </div>

          {/* Corrections */}
          {top_corrections.length > 0 && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>✏️ Remember</h2>
              <ul className={styles.list}>
                {top_corrections.map((c, i) => <li key={i} className={styles.listItem}>{c}</li>)}
              </ul>
            </div>
          )}

          {/* Vocab */}
          {vocab?.length > 0 && (
            <div className={styles.card + ' ' + styles.cardFull}>
              <h2 className={styles.cardTitle}>📚 Added to your deck</h2>
              <div className={styles.vocabGrid}>
                {vocab.map((v, i) => (
                  <div key={i} className={styles.vocabChip}>
                    <span className={styles.vocabWord}>{v.item}</span>
                    <span className={styles.vocabGloss}>{v.gloss}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button className={styles.primaryBtn} onClick={() => navigate('/')}>
            Keep going 🔥
          </button>
          <button className={styles.secondaryBtn} onClick={() => navigate('/srs')}>
            Review vocab →
          </button>
        </div>
      </div>
    </Layout>
  );
}
