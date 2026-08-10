import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { API } from '../../src/api';
import { useAuth } from '../../src/auth';
import { theme } from '../../src/utils';
import { Button } from '../../src/components';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!phone || !password) { setError('Isi nomor HP dan password'); return; }
    setError(''); setLoading(true);
    try {
      const data = await API.auth.login({ phone, password });
      signIn(data.token, data.user);
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e.message || 'Login gagal');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>🎮</Text>
        <Text style={styles.title}>DANAPLAY</Text>
        <Text style={styles.sub}>Masuk untuk mulai dapatkan reward</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Nomor HP</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone}
            placeholder="08xxxxxxxxxx" placeholderTextColor={theme.faint} keyboardType="phone-pad" />
          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword}
            placeholder="Password" placeholderTextColor={theme.faint} secureTextEntry />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="MASUK" onPress={submit} loading={loading} style={{ marginTop: 14 }} size="lg" />
          <View style={styles.registerRow}>
            <Text style={styles.muted}>Belum punya akun? </Text>
            <Text style={styles.link} onPress={() => router.push('/(auth)/register')}>Daftar sekarang</Text>
          </View>
        </View>
        <Text style={styles.demo}>DEMO · 081234567890 / password123</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.bg },
  container: { flexGrow: 1, paddingTop: 70, paddingHorizontal: 16, alignItems: 'center' },
  logo: { fontSize: 48 },
  title: { fontSize: 26, fontWeight: '800', marginTop: 8, color: theme.text },
  sub: { fontSize: 13, color: theme.muted, marginTop: 2 },
  card: { backgroundColor: theme.surface, borderRadius: theme.radius, padding: 16, marginTop: 28, width: '100%', maxWidth: 400, shadowColor: '#101C3C', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 4, color: theme.text },
  input: { borderWidth: 1.5, borderColor: theme.border, borderRadius: theme.radiusSm, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: theme.text, marginBottom: 8 },
  error: { color: theme.danger, fontSize: 12, marginTop: 4 },
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.border },
  muted: { fontSize: 13, color: theme.muted },
  link: { fontSize: 13, color: theme.primary, fontWeight: '600' },
  demo: { marginTop: 18, fontSize: 11, color: theme.warning, backgroundColor: theme.warningBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, overflow: 'hidden' },
});
