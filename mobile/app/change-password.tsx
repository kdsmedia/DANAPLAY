import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { API } from '../src/api';
import { theme } from '../src/utils';
import { Card, Button } from '../src/components';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!current || !next || !confirm) { Alert.alert('Lengkapi', 'Isi semua field'); return; }
    if (next !== confirm) { Alert.alert('Gagal', 'Password baru tidak cocok'); return; }
    if (next.length < 8) { Alert.alert('Gagal', 'Password baru minimal 8 karakter'); return; }
    setLoading(true);
    try {
      await API.user.changePassword({ currentPassword: current, newPassword: next });
      Alert.alert('✅ Berhasil', 'Password berhasil diubah. Silakan login kembali.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (e: any) { Alert.alert('Gagal', e.message); } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <View style={styles.topbar}>
        <Button title="←" variant="ghost" onPress={() => router.back()} style={styles.backBtn} />
        <Text style={styles.topTitle}>Ganti Password</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={styles.label}>Password Saat Ini</Text>
          <TextInput style={styles.input} value={current} onChangeText={setCurrent} secureTextEntry placeholder="••••••••" placeholderTextColor={theme.faint} />
          <Text style={styles.label}>Password Baru</Text>
          <TextInput style={styles.input} value={next} onChangeText={setNext} secureTextEntry placeholder="Min. 8 karakter" placeholderTextColor={theme.faint} />
          <Text style={styles.hint}>Minimal 8 karakter</Text>
          <Text style={styles.label}>Konfirmasi Password Baru</Text>
          <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="••••••••" placeholderTextColor={theme.faint} />
          <Button title="UBAH PASSWORD" size="lg" loading={loading} onPress={submit} style={{ marginTop: 14 }} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.bg },
  topbar: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary, paddingHorizontal: 8, paddingTop: 48, paddingBottom: 14, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  backBtn: { width: 46, height: 38, borderRadius: 19 },
  topTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginLeft: 4 },
  scroll: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  input: { borderWidth: 1.5, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: theme.text, marginBottom: 4 },
  hint: { fontSize: 11, color: theme.faint, marginBottom: 8 },
});
