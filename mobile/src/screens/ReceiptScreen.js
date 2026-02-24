import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function ReceiptScreen({ navigation, route }) {
  const { receipt, sessionId } = route.params ?? {};
  const { wins = [], top_corrections = [], summary = '', vocab = [], errors = [] } = receipt ?? {};

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        <Text style={styles.title}>Session done 🎉</Text>
        <Text style={styles.summary}>{summary}</Text>

        {/* Wins */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>✅ Wins</Text>
          {wins.map((win, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{win}</Text>
            </View>
          ))}
        </View>

        {/* Corrections */}
        {top_corrections.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>✏️ To remember</Text>
            {top_corrections.map((c, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={styles.bullet}>→</Text>
                <Text style={styles.listText}>{c}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Vocab added */}
        {vocab?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📚 Added to your deck</Text>
            {vocab.map((v, i) => (
              <View key={i} style={styles.vocabRow}>
                <Text style={styles.vocabWord}>{v.item}</Text>
                <Text style={styles.vocabGloss}>{v.gloss}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <TouchableOpacity
          style={styles.keepGoingBtn}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.keepGoingText}>Keep going 🔥</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.doneBtnText}>Done for now</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFF' },
  scroll: { padding: 24, paddingBottom: 48 },

  title: { fontSize: 28, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  summary: { fontSize: 15, color: '#64748B', lineHeight: 22, marginBottom: 24 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },

  listItem: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'flex-start' },
  bullet: { fontSize: 15, color: '#1A56DB', fontWeight: '700', marginTop: 1 },
  listText: { flex: 1, fontSize: 14, color: '#1E293B', lineHeight: 20 },

  vocabRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  vocabWord: { fontSize: 15, fontWeight: '700', color: '#1A56DB' },
  vocabGloss: { fontSize: 14, color: '#64748B' },

  keepGoingBtn: {
    backgroundColor: '#1A56DB', borderRadius: 16, paddingVertical: 18,
    alignItems: 'center', marginBottom: 12,
    shadowColor: '#1A56DB', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  keepGoingText: { color: '#fff', fontSize: 17, fontWeight: '800' },

  doneBtn: {
    backgroundColor: '#E2E8F0', borderRadius: 16, paddingVertical: 16, alignItems: 'center',
  },
  doneBtnText: { color: '#64748B', fontSize: 16, fontWeight: '600' },
});
