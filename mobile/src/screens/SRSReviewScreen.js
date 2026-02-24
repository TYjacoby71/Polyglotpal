import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Tts from 'react-native-tts';
import { userAPI } from '../services/api';

export function SRSReviewScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [current, setCurrent] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    userAPI.getSRSDeck('es', 10)
      .then(data => { setItems(data.items); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const flipCard = () => {
    Animated.spring(flipAnim, { toValue: 1, useNativeDriver: true }).start();
    setRevealed(true);
    const item = items[current];
    if (item) Tts.speak(item.item, { language: 'es-ES', rate: 0.8 });
  };

  const submitQuality = async (quality) => {
    const item = items[current];
    if (!item) return;

    await userAPI.submitReview(item.id, quality).catch(() => {});

    const isCorrect = quality >= 3;
    setScore(s => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));

    const next = current + 1;
    if (next >= items.length) {
      setDone(true);
    } else {
      setCurrent(next);
      setRevealed(false);
      flipAnim.setValue(0);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#1A56DB" />
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyTitle}>All caught up! 🎉</Text>
        <Text style={styles.emptyText}>No words due for review today.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (done) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.doneEmoji}>🎯</Text>
        <Text style={styles.doneTitle}>Review complete!</Text>
        <Text style={styles.doneScore}>{score.correct} / {score.total} correct</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const item = items[current];
  const progress = (current / items.length) * 100;

  return (
    <SafeAreaView style={styles.container}>

      {/* Progress bar */}
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.progressLabel}>{current + 1} / {items.length}</Text>

      {/* Card */}
      <View style={styles.cardArea}>
        <View style={styles.card}>
          <Text style={styles.cardWord}>{item.item}</Text>
          {item.example_sentence && (
            <Text style={styles.cardExample}>"{item.example_sentence}"</Text>
          )}

          {!revealed ? (
            <TouchableOpacity style={styles.revealBtn} onPress={flipCard}>
              <Text style={styles.revealBtnText}>Tap to reveal 👆</Text>
            </TouchableOpacity>
          ) : (
            <Animated.View style={styles.answer}>
              <Text style={styles.gloss}>{item.gloss}</Text>
              <TouchableOpacity
                style={styles.listenBtn}
                onPress={() => Tts.speak(item.item, { language: 'es-ES', rate: 0.7 })}
              >
                <Text style={styles.listenBtnText}>🔊 Hear it</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View>

      {/* Rating buttons */}
      {revealed && (
        <View style={styles.ratingArea}>
          <Text style={styles.ratingLabel}>How well did you know it?</Text>
          <View style={styles.ratingRow}>
            <RatingBtn label="❌" sublabel="Nope" quality={1} color="#FEE2E2" textColor="#DC2626" onPress={submitQuality} />
            <RatingBtn label="😬" sublabel="Fuzzy" quality={3} color="#FEF3C7" textColor="#D97706" onPress={submitQuality} />
            <RatingBtn label="✅" sublabel="Got it" quality={5} color="#DCFCE7" textColor="#16A34A" onPress={submitQuality} />
          </View>
        </View>
      )}

    </SafeAreaView>
  );
}

function RatingBtn({ label, sublabel, quality, color, textColor, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.ratingBtn, { backgroundColor: color }]}
      onPress={() => onPress(quality)}
    >
      <Text style={styles.ratingEmoji}>{label}</Text>
      <Text style={[styles.ratingSubLabel, { color: textColor }]}>{sublabel}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F8FAFF' },

  progressBg: { height: 4, backgroundColor: '#E2E8F0', marginHorizontal: 20, marginTop: 12, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: '#1A56DB', borderRadius: 2 },
  progressLabel: { textAlign: 'center', fontSize: 12, color: '#94A3B8', marginTop: 6 },

  cardArea: { flex: 1, justifyContent: 'center', padding: 20 },
  card: {
    backgroundColor: '#fff', borderRadius: 24, padding: 32, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
    minHeight: 260, justifyContent: 'center',
  },
  cardWord: { fontSize: 36, fontWeight: '800', color: '#1A56DB', textAlign: 'center', marginBottom: 12 },
  cardExample: { fontSize: 14, color: '#94A3B8', textAlign: 'center', fontStyle: 'italic', marginBottom: 24, lineHeight: 20 },

  revealBtn: {
    backgroundColor: '#EEF4FF', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12,
  },
  revealBtnText: { fontSize: 15, color: '#1A56DB', fontWeight: '600' },

  answer: { alignItems: 'center', gap: 16 },
  gloss: { fontSize: 26, fontWeight: '700', color: '#1E293B', textAlign: 'center' },
  listenBtn: { backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  listenBtnText: { fontSize: 14, color: '#475569', fontWeight: '600' },

  ratingArea: { padding: 20, paddingBottom: 32 },
  ratingLabel: { fontSize: 13, color: '#64748B', fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  ratingRow: { flexDirection: 'row', gap: 12 },
  ratingBtn: { flex: 1, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  ratingEmoji: { fontSize: 24, marginBottom: 4 },
  ratingSubLabel: { fontSize: 12, fontWeight: '700' },

  emptyTitle: { fontSize: 24, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  emptyText: { fontSize: 15, color: '#64748B', marginBottom: 24 },

  doneEmoji: { fontSize: 48, marginBottom: 12 },
  doneTitle: { fontSize: 24, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  doneScore: { fontSize: 18, color: '#1A56DB', fontWeight: '700', marginBottom: 28 },

  backBtn: { backgroundColor: '#1A56DB', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  backBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
