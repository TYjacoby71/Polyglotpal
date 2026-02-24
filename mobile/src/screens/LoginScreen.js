import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../store/AuthContext';

export function LoginScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email.trim().toLowerCase(), password);
      } else {
        if (password.length < 8) {
          Alert.alert('Weak password', 'Password must be at least 8 characters.');
          setLoading(false);
          return;
        }
        await register(email.trim().toLowerCase(), password);
      }
      // Navigation handled by AppNavigator watching auth state
    } catch (err) {
      const msg = err?.response?.data?.error ?? 'Something went wrong. Try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <View style={styles.logoBlock}>
            <Text style={styles.logo}>PolyglotPal</Text>
            <Text style={styles.tagline}>Chat your way to fluency 🌍</Text>
          </View>

          {/* Mode toggle */}
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'login' && styles.modeBtnActive]}
              onPress={() => setMode('login')}
            >
              <Text style={[styles.modeBtnText, mode === 'login' && styles.modeBtnTextActive]}>
                Log in
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'register' && styles.modeBtnActive]}
              onPress={() => setMode('register')}
            >
              <Text style={[styles.modeBtnText, mode === 'register' && styles.modeBtnTextActive]}>
                Sign up
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
              placeholderTextColor="#94A3B8"
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>
                    {mode === 'login' ? 'Log in' : 'Create account'}
                  </Text>
              }
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <Text style={styles.footer}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <Text style={styles.footerLink} onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Sign up' : 'Log in'}
            </Text>
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFF' },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 28 },

  logoBlock: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 36, fontWeight: '800', color: '#1A56DB' },
  tagline: { fontSize: 15, color: '#64748B', marginTop: 6 },

  modeRow: {
    flexDirection: 'row', backgroundColor: '#E2E8F0',
    borderRadius: 14, padding: 4, marginBottom: 28,
  },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  modeBtnText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  modeBtnTextActive: { color: '#1A56DB' },

  form: { gap: 8, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0',
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#1E293B',
  },

  submitBtn: {
    backgroundColor: '#1A56DB', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 12,
    shadowColor: '#1A56DB', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  footer: { textAlign: 'center', fontSize: 14, color: '#64748B' },
  footerLink: { color: '#1A56DB', fontWeight: '600' },
});
