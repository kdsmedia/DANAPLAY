import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { API } from '../../src/api';
import { useAuth } from '../../src/auth';
import { theme } from '../../src/utils';
import { Button } from '../../src/components';

export default function RegisterScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name || !phone || !password) { setError('Lengkapi semua field'); return; }
    setError(''); setLoading(true);
    try {
      const body: any = { name, phone, password };
      const rc = referralCode.trim().toUpperCase();
      if (rc) body.referralCode = rc;
      const data = await API.auth.register(body);
      signIn(data.token, data.user);
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e.message || 'Pendaftaran gagal');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>🎮</Text>
        <Text style={styles.title}>Buat Akun Baru</Text>
        <Text style={styles.sub}>Daftar untuk mulai kumpulkan poin</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Nama Lengkap</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nama Anda" placeholderTextColor={theme.faint} />
          <Text style={styles.label}>Nomor HP</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="08xxxxxxxxxx" placeholderTextColor={theme.faint} keyboardType="phone-pad" />
          <Text style={styles.hint}>Format: 08xxxxxxxxxx</Text>
          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Min. 8 karakter" placeholderTextColor={theme.faint} secureTextEntry />
          <Text style={styles.hint}>Minimal 8 karakter</Text>
          <Text style={styles.label}>Kode Referral (opsional)</Text>
          <TextInput style={styles.input} value={referralCode} onChangeText={(t) => setReferralCode(t.toUpperCase())} placeholder="Contoh: ABC1234" placeholderTextColor={theme.faint} autoCapitalize="characters" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="DAFTAR" onPress={submit} loading={loading} style={{ marginTop: 14 }} size="lg" />
          <View style={styles.registerRow}>
            <Text style={styles.muted}>Sudah punya akun? </Text>
            <Text style={styles.link} onPress={() => router.push('/(auth)/login')}>Masuk</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.bg },
  container: { flexGrow: 1, paddingTop: 50, paddingHorizontal: 16, alignItems: 'center' },
  logo: { fontSize: 40 },
  title: { fontSize: 22, fontWeight: '800', marginTop: 6, color: theme.text },
  sub: { fontSize: 13, color: theme.muted, marginTop: 2 },
  card: { backgroundColor: theme.surface, borderRadius: theme.radius, padding: 16, marginTop: 24, width: '100%', maxWidth: 400, shadowColor: '#101C3C', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 4, color: theme.text },
  input: { borderWidth: 1.5, borderColor: theme.border, borderRadius: theme.radiusSm, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: theme.text },
  hint: { fontSize: 11, color: theme.faint, marginBottom: 6 },
  error: { color: theme.danger, fontSize: 12, marginTop: 4 },
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.border },
  muted: { fontSize: 13, color: theme.muted },
  link: { fontSize: 13, color: theme.primary, fontWeight: '600' },
});
