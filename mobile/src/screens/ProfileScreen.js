import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Switch, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../store/AuthContext';
import { userAPI } from '../services/api';

const INTENSITY_OPTIONS = [
  { key: 'low',    label: 'Less',   desc: 'Mostly recasts, minimal nudges' },
  { key: 'medium', label: 'Medium', desc: 'Balanced — the default' },
  { key: 'high',   label: 'More',   desc: 'More explicit corrections' },
];

const NOTIF_FREQ = [
  { key: 'daily',        label: 'Once a day' },
  { key: 'three_weekly', label: '3× a week' },
  { key: 'weekdays',     label: 'Weekdays only' },
];

export function ProfileScreen() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [intensity, setIntensity] = useState(user?.correction_intensity ?? 'medium');
  const [storeTranscripts, setStoreTranscripts] = useState(user?.store_transcripts ?? false);
  const [notifFreq, setNotifFreq] = useState('daily');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userAPI.getStats().then(s => { setStats(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await userAPI.updatePrefs({
        correction_intensity: intensity,
        store_transcripts: storeTranscripts,
        notif_preferences: { frequency: notifFreq },
      });
      Alert.alert('Saved', 'Preferences updated.');
    } catch {
      Alert.alert('Error', 'Could not save preferences.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Stats */}
        {!loading && stats && (
          <View style={styles.statsRow}>
            <StatCard num={stats.streak_days} label="day streak 🔥" />
            <StatCard num={stats.weekly_minutes} label="min this week" />
            <StatCard num={stats.total_sessions} label="sessions" />
          </View>
        )}

        {/* Skill levels */}
        {stats?.skills?.length > 0 && (
          <Section title="Your levels">
            {stats.skills.map(s => (
              <View key={s.language} style={styles.skillRow}>
                <Text style={styles.skillLang}>{s.language.toUpperCase()}</Text>
                <View style={styles.skillRight}>
                  <Text style={styles.skillCefr}>{s.cefr_estimate}</Text>
                  <View style={styles.skillBars}>
                    <SkillBar label="Comp" value={s.comprehension_score} />
                    <SkillBar label="Prod" value={s.production_score} />
                  </View>
                </View>
              </View>
            ))}
          </Section>
        )}

        {/* Correction intensity */}
        <Section title="Correction style">
          {INTENSITY_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.optionRow, intensity === opt.key && styles.optionRowActive]}
              onPress={() => setIntensity(opt.key)}
            >
              <View style={styles.optionLeft}>
                <Text style={[styles.optionLabel, intensity === opt.key && styles.optionLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={styles.optionDesc}>{opt.desc}</Text>
              </View>
              {intensity === opt.key && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </Section>

        {/* Notification frequency */}
        <Section title="Notification frequency">
          {NOTIF_FREQ.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.optionRow, notifFreq === opt.key && styles.optionRowActive]}
              onPress={() => setNotifFreq(opt.key)}
            >
              <Text style={[styles.optionLabel, notifFreq === opt.key && styles.optionLabelActive]}>
                {opt.label}
              </Text>
              {notifFreq === opt.key && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </Section>

        {/* Privacy */}
        <Section title="Privacy">
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.optionLabel}>Store conversation transcripts</Text>
              <Text style={styles.optionDesc}>Off by default — only structured signals are saved</Text>
            </View>
            <Switch
              value={storeTranscripts}
              onValueChange={setStoreTranscripts}
              trackColor={{ true: '#1A56DB' }}
            />
          </View>
        </Section>

        {/* Save */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Save preferences</Text>
          }
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Log out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function StatCard({ num, label }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statNum}>{num ?? 0}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SkillBar({ label, value }) {
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${Math.round((value ?? 0.5) * 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFF' },
  scroll: { padding: 20, paddingBottom: 48 },

  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#1E293B' },
  email: { fontSize: 14, color: '#64748B', marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12,
    alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  statNum: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  statLabel: { fontSize: 10, color: '#64748B', textAlign: 'center', marginTop: 2 },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },

  optionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  optionRowActive: { backgroundColor: '#EEF4FF' },
  optionLeft: { flex: 1 },
  optionLabel: { fontSize: 15, color: '#1E293B', fontWeight: '500' },
  optionLabelActive: { color: '#1A56DB', fontWeight: '700' },
  optionDesc: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  checkmark: { fontSize: 16, color: '#1A56DB', fontWeight: '700' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },

  skillRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  skillLang: { fontSize: 18, fontWeight: '800', color: '#1A56DB', width: 44 },
  skillRight: { flex: 1 },
  skillCefr: { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 6 },
  skillBars: { gap: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { fontSize: 10, color: '#94A3B8', width: 28 },
  barBg: { flex: 1, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2 },
  barFill: { height: 4, backgroundColor: '#1A56DB', borderRadius: 2 },

  saveBtn: {
    backgroundColor: '#1A56DB', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 12,
    shadowColor: '#1A56DB', shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  logoutBtn: { backgroundColor: '#FEE2E2', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  logoutBtnText: { color: '#DC2626', fontSize: 15, fontWeight: '600' },
});
