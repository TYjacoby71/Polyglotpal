import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Animated, PanResponder
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Tts from 'react-native-tts';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { conversationAPI, sessionAPI } from '../services/api';

const recorder = new AudioRecorderPlayer();

const OPENING_MESSAGES = {
  conversation: '¡Hola! ¿Qué tal? What\'s going on today?',
  mixed: '¿Cómo estuvo tu día? Tell me — in Spanish if you can!',
  micro_quiz: null, // injected from notification
};

export function ConversationScreen({ navigation, route }) {
  const { sessionId, triggerType = 'conversation', quizWord } = route.params ?? {};

  const [turns, setTurns] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [correction, setCorrection] = useState(null);
  const [tlRatio, setTlRatio] = useState(0.3);
  const scrollRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Bootstrap opening message ─────────────────────────────────────
  useEffect(() => {
    const opening = quizWord
      ? `¿Qué significa "${quizWord}"? Do you know it?`
      : OPENING_MESSAGES[triggerType];

    if (opening) {
      const firstTurn = { role: 'assistant', content: opening };
      setTurns([firstTurn]);
      Tts.speak(opening, { language: 'es-ES', rate: 0.85 });
    }
  }, []);

  // ── Recording pulse animation ─────────────────────────────────────
  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  };

  const stopPulse = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  // ── Push-to-talk handlers ─────────────────────────────────────────
  const handleMicPressIn = async () => {
    setIsRecording(true);
    setCorrection(null);
    startPulse();
    await recorder.startRecorder();
  };

  const handleMicPressOut = async () => {
    setIsRecording(false);
    stopPulse();
    setIsProcessing(true);

    try {
      const audioPath = await recorder.stopRecorder();

      // Transcribe
      const { transcript } = await conversationAPI.transcribeAudio(audioPath);
      if (!transcript?.trim()) {
        setIsProcessing(false);
        return;
      }

      // Add user turn locally
      const userTurn = { role: 'user', content: transcript };
      const updatedTurns = [...turns, userTurn];
      setTurns(updatedTurns);
      scrollRef.current?.scrollToEnd({ animated: true });

      // Get bot reply
      const result = await conversationAPI.sendTurn({
        sessionId,
        userText: transcript,
        turnHistory: updatedTurns.slice(-10), // last 10 turns
      });

      // Strip [VOCAB:...] and [RECAST:...] tags from display
      const cleanReply = result.reply.replace(/\[(VOCAB|RECAST):[^\]]+\]/g, '').trim();

      const botTurn = { role: 'assistant', content: cleanReply };
      setTurns(prev => [...prev, botTurn]);
      setTlRatio(result.tl_ratio);
      if (result.correction) setCorrection(result.correction);

      // Speak reply
      Tts.speak(cleanReply, { language: 'es-ES', rate: 0.85 });
      scrollRef.current?.scrollToEnd({ animated: true });

    } catch (e) {
      console.error('Turn error:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── End session ───────────────────────────────────────────────────
  const handleEnd = async () => {
    try {
      await sessionAPI.end(sessionId, {
        target_language_ratio_avg: tlRatio,
      });
      const receipt = await conversationAPI.getReceipt(sessionId);
      navigation.replace('Receipt', { receipt, sessionId });
    } catch (e) {
      console.error(e);
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleEnd}>
          <Text style={styles.endBtn}>Done</Text>
        </TouchableOpacity>
        <View style={styles.tlIndicator}>
          <View style={[styles.tlBar, { width: `${Math.round(tlRatio * 100)}%` }]} />
          <Text style={styles.tlLabel}>{Math.round(tlRatio * 100)}% ES</Text>
        </View>
      </View>

      {/* Conversation */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {turns.map((turn, i) => (
          <View key={i} style={[styles.bubble, turn.role === 'user' ? styles.userBubble : styles.botBubble]}>
            <Text style={[styles.bubbleText, turn.role === 'user' && styles.userBubbleText]}>
              {turn.content}
            </Text>
          </View>
        ))}

        {isProcessing && (
          <View style={[styles.bubble, styles.botBubble]}>
            <ActivityIndicator size="small" color="#1A56DB" />
          </View>
        )}

        {/* Correction banner */}
        {correction && (
          <View style={styles.correctionBanner}>
            <Text style={styles.correctionLabel}>
              {correction.correction_mode === 'explicit' ? '✏️ Quick fix' : '💡 Tip'}
            </Text>
            <Text style={styles.correctionText}>
              <Text style={styles.wrong}>{correction.wrong_span}</Text>
              {' → '}
              <Text style={styles.correct}>{correction.corrected_span}</Text>
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Translate + Slower */}
        <View style={styles.helperBtns}>
          <TouchableOpacity
            style={styles.helperBtn}
            onPressIn={() => setShowTranslation(true)}
            onPressOut={() => setShowTranslation(false)}
          >
            <Text style={styles.helperBtnText}>
              {showTranslation ? '👁 Hiding...' : '🔍 Hold to translate'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.helperBtn}
            onPress={() => {
              const lastBot = [...turns].reverse().find(t => t.role === 'assistant');
              if (lastBot) Tts.speak(lastBot.content, { language: 'es-ES', rate: 0.65 });
            }}
          >
            <Text style={styles.helperBtnText}>🐢 Slower</Text>
          </TouchableOpacity>
        </View>

        {/* Mic button */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[styles.micBtn, isRecording && styles.micBtnActive]}
            onPressIn={handleMicPressIn}
            onPressOut={handleMicPressOut}
            activeOpacity={0.9}
          >
            <Text style={styles.micIcon}>{isRecording ? '🔴' : '🎙️'}</Text>
            <Text style={styles.micLabel}>{isRecording ? 'Recording…' : 'Hold to speak'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFF' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  endBtn: { fontSize: 16, color: '#1A56DB', fontWeight: '600' },
  tlIndicator: {
    flex: 1, marginLeft: 16, height: 6, backgroundColor: '#E2E8F0',
    borderRadius: 3, overflow: 'hidden', position: 'relative',
    flexDirection: 'row', alignItems: 'center',
  },
  tlBar: { height: 6, backgroundColor: '#1A56DB', borderRadius: 3 },
  tlLabel: { position: 'absolute', right: 0, fontSize: 10, color: '#64748B' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 10 },

  bubble: {
    maxWidth: '80%', borderRadius: 18, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  botBubble: { backgroundColor: '#fff', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  userBubble: { backgroundColor: '#1A56DB', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 15, color: '#1E293B', lineHeight: 22 },
  userBubbleText: { color: '#fff' },

  correctionBanner: {
    backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12,
    borderLeftWidth: 3, borderLeftColor: '#F59E0B',
  },
  correctionLabel: { fontSize: 11, fontWeight: '700', color: '#92400E', marginBottom: 4, textTransform: 'uppercase' },
  correctionText: { fontSize: 14 },
  wrong: { color: '#DC2626', textDecorationLine: 'line-through' },
  correct: { color: '#16A34A', fontWeight: '700' },

  controls: { padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  helperBtns: { flexDirection: 'row', gap: 10 },
  helperBtn: {
    flex: 1, paddingVertical: 8, backgroundColor: '#E2E8F0',
    borderRadius: 10, alignItems: 'center',
  },
  helperBtnText: { fontSize: 12, color: '#475569', fontWeight: '600' },

  micBtn: {
    backgroundColor: '#1A56DB', borderRadius: 20, paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#1A56DB', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  micBtnActive: { backgroundColor: '#DC2626' },
  micIcon: { fontSize: 28 },
  micLabel: { color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 4 },
});
