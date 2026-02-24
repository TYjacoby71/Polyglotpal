import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { userAPI, sessionAPI } from '../services/api';

const FOCUS_OPTIONS = ['Open', 'Travel', 'Work', 'Food', 'Slang'];

export function HomeScreen({ navigation }) {
  const [stats, setStats] = useState(null);
  const [srsItems, setSrsItems] = useState([]);
  const [mixingLevel, setMixingLevel] = useState('Off'); // Off | Light | Heavy
  const [focus, setFocus] = useState('Open');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [statsData, srsData] = await Promise.all([
        userAPI.getStats(),
        userAPI.getSRSDeck('es', 3),
      ]);
      setStats(statsData);
      setSrsItems(srsData.items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleTalkNow = async () => {
    try {
      const { session } = await sessionAPI.start('conversation', 'es');
      navigation.navigate('Conversation', { sessionId: session.id, focus });
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#1A56DB" />
      </SafeAreaView>
    );
  }

  const skill = stats?.skills?.[0];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>PolyglotPal</Text>
          <Text style={styles.level}>{skill?.cefr_estimate ?? 'A1'} · Spanish</Text>
        </View>

        {/* Streak + minutes */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats?.streak_days ?? 0}</Text>
            <Text style={styles.statLabel}>day streak 🔥</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats?.weekly_minutes ?? 0}</Text>
            <Text style={styles.statLabel}>min this week</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats?.total_sessions ?? 0}</Text>
            <Text style={styles.statLabel}>sessions</Text>
          </View>
        </View>

        {/* Talk Now CTA */}
        <TouchableOpacity style={styles.talkBtn} onPress={handleTalkNow} activeOpacity={0.85}>
          <Text style={styles.talkBtnText}>Talk Now 🎙️</Text>
        </TouchableOpacity>

        {/* Focus selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's focus</Text>
          <View style={styles.focusRow}>
            {FOCUS_OPTIONS.map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.focusChip, focus === f && styles.focusChipActive]}
                onPress={() => setFocus(f)}
              >
                <Text style={[styles.focusChipText, focus === f && styles.focusChipTextActive]}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Mixing toggle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Language mixing</Text>
          <View style={styles.mixingRow}>
            {['Off', 'Light', 'Heavy'].map(level => (
              <TouchableOpacity
                key={level}
                style={[styles.mixingChip, mixingLevel === level && styles.mixingChipActive]}
                onPress={() => setMixingLevel(level)}
              >
                <Text style={[styles.mixingChipText, mixingLevel === level && styles.mixingChipTextActive]}>
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* SRS mini deck */}
        {srsItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Review today</Text>
            {srsItems.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.srsCard}
                onPress={() => navigation.navigate('SRSReview', { itemId: item.id })}
              >
                <Text style={styles.srsWord}>{item.item}</Text>
                <Text style={styles.srsGloss}>{item.gloss}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  logo: { fontSize: 24, fontWeight: '800', color: '#1A56DB' },
  level: { fontSize: 14, color: '#64748B', fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14,
    padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statNum: { fontSize: 26, fontWeight: '800', color: '#1E293B' },
  statLabel: { fontSize: 11, color: '#64748B', marginTop: 2, textAlign: 'center' },

  talkBtn: {
    backgroundColor: '#1A56DB', borderRadius: 20, paddingVertical: 20,
    alignItems: 'center', marginBottom: 28,
    shadowColor: '#1A56DB', shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  talkBtnText: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 0.3 },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  focusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  focusChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E2E8F0' },
  focusChipActive: { backgroundColor: '#1A56DB' },
  focusChipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  focusChipTextActive: { color: '#fff' },

  mixingRow: { flexDirection: 'row', gap: 10 },
  mixingChip: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#E2E8F0', alignItems: 'center' },
  mixingChipActive: { backgroundColor: '#DBEAFE' },
  mixingChipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  mixingChipTextActive: { color: '#1A56DB' },

  srsCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  srsWord: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  srsGloss: { fontSize: 13, color: '#64748B' },
});
