import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth';
import { API } from '../../src/api';
import { theme, fmtPts } from '../../src/utils';
import { Card, Button, Badge } from '../../src/components';

export default function ProfileScreen() {
  const { user, signOut, setUser } = useAuth();
  const router = useRouter();
  const [editVisible, setEditVisible] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  const saveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const data = await API.user.updateProfile(name.trim());
      setUser(data.user);
      setEditVisible(false);
      Alert.alert('Berhasil', 'Profil diperbarui');
    } catch (e: any) { Alert.alert('Gagal', e.message); } finally { setSaving(false); }
  };

  const logout = () => {
    Alert.alert('Logout', 'Yakin ingin keluar?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'LOGOUT', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <View style={styles.flex}>
      <View style={styles.topbar}><Text style={styles.topTitle}>Profil</Text></View>
      <View style={styles.content}>
        <Card style={styles.profileCard}>
          <Text style={styles.avatar}>👤</Text>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.phone}>{user?.phone}</Text>
          <View style={{ marginTop: 8 }}><Badge status="COMPLETED" /><Text style={styles.codeInline}>Kode: {user?.referral_code}</Text></View>
        </Card>
        <Card>
          <RowItem icon="🔒" label="Ganti Password" onPress={() => router.push('/change-password')} />
          <Divider />
          <RowItem icon="✏️" label="Edit Profil" onPress={() => { setName(user?.name || ''); setEditVisible(true); }} />
        </Card>
        <Button title="LOGOUT" variant="danger" size="lg" onPress={logout} />
        <Text style={styles.footNote}>Saldo: {fmtPts(user?.points_balance || 0)} poin</Text>
      </View>
      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={() => setEditVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Profil</Text>
            <Text style={styles.modalSub}>Ubah nama Anda</Text>
            <Text style={styles.label}>Nama</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} />
            <View style={styles.modalActions}>
              <Button title="Batal" variant="outline" onPress={() => setEditVisible(false)} style={{ flex: 1, marginRight: 8 }} />
              <Button title="SIMPAN" onPress={saveName} loading={saving} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function RowItem({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.rowItem} onPress={onPress}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowArrow}>›</Text>
    </TouchableOpacity>
  );
}
function Divider() { return <View style={styles.divider} />; }

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.bg },
  topbar: { backgroundColor: theme.primary, paddingHorizontal: 16, paddingTop: 48, paddingBottom: 14, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  topTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 40, flex: 1 },
  profileCard: { alignItems: 'center', paddingVertical: 24 },
  avatar: { fontSize: 48 },
  name: { fontSize: 18, fontWeight: '700', marginTop: 6 },
  phone: { fontSize: 13, color: theme.muted, marginTop: 2 },
  codeInline: { fontSize: 12, color: theme.muted, marginTop: 6 },
  rowItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowIcon: { fontSize: 18, marginRight: 12 },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  rowArrow: { fontSize: 20, color: theme.faint },
  divider: { height: 1, backgroundColor: theme.border },
  footNote: { textAlign: 'center', fontSize: 12, color: theme.faint, marginTop: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(11,23,38,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: theme.surface, borderRadius: 22, padding: 22, width: '100%', maxWidth: 360 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalSub: { fontSize: 13, color: theme.muted, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: theme.text, marginBottom: 14 },
  modalActions: { flexDirection: 'row' },
});
