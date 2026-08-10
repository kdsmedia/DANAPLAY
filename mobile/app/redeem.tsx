import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { API } from '../src/api';
import { useAuth } from '../src/auth';
import { theme, fmtRp, fmtPts } from '../src/utils';
import { Card, Button, ConfirmModal, EmptyState, Loading } from '../src/components';

export default function RedeemScreen() {
  const router = useRouter();
  const { balance, refreshBalance } = useAuth();
  const [denoms, setDenoms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [danaNumber, setDanaNumber] = useState('');
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try { setDenoms(await API.withdrawals.denominations()); } catch {} finally { setLoading(false); }
    })();
    refreshBalance();
  }, []);

  const pointsBalance = balance?.points || 0;
  const validDana = /^08\d{8,12}$/.test(danaNumber);
  const canConfirm = selected && validDana;

  const confirm = async () => {
    setConfirmVisible(false);
    setSubmitting(true);
    try {
      const res = await API.withdrawals.create({ amount: selected.amount, destination: danaNumber });
      await refreshBalance();
      setDanaNumber('');
      setSelected(null);
      Alert.alert(
        res.status === 'COMPLETED' ? '✅ Berhasil' : '⏳ Diproses',
        res.status === 'COMPLETED'
          ? `Penukaran ${fmtRp(res.amount)} ke DANA ${res.destination} berhasil. -${fmtPts(res.points)} poin.`
          : `Penukaran ${fmtRp(res.amount)} sedang diproses. Status: ${res.status}.`,
        [{ text: 'Lihat Riwayat', onPress: () => router.replace('/(tabs)/history') }, { text: 'OK' }]
      );
    } catch (e: any) {
      Alert.alert('Gagal', e.message);
    } finally { setSubmitting(false); }
  };

  return (
    <View style={styles.flex}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>←</Text></TouchableOpacity>
        <Text style={styles.topTitle}>Tukar Poin</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>SALDO ANDA</Text>
          <Text style={styles.balancePts}>⭐ {fmtPts(pointsBalance)} Poin</Text>
          <Text style={styles.balanceRp}>= {fmtRp(Math.floor(pointsBalance / 1000))}</Text>
        </View>
        <Text style={styles.sectionTitle}>Pilih Nominal</Text>
        {loading ? <Loading label="Memuat nominal..." /> : (
          <View style={styles.denomGrid}>
            {denoms.map((d) => {
              const enabled = d.enabled && pointsBalance >= d.points;
              const isSel = selected && selected.amount === d.amount;
              return (
                <TouchableOpacity
                  key={d.amount}
                  style={[styles.denomCard, !enabled && styles.denomDisabled, isSel && styles.denomSelected]}
                  disabled={!enabled}
                  onPress={() => setSelected(d)}
                >
                  <Text style={[styles.denomRp, !enabled && { color: theme.faint }, isSel && { color: '#fff' }]}>{fmtRp(d.amount)}</Text>
                  <Text style={[styles.denomPts, !enabled && { color: theme.faint }, isSel && { color: 'rgba(255,255,255,0.85)' }]}>{fmtPts(d.points)} poin</Text>
                  {!enabled && <Text style={styles.denomLock}>🔒</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        <Text style={styles.sectionTitle}>Nomor DANA</Text>
        <TextInput
          style={[styles.input, danaNumber && !validDana && styles.inputError]}
          value={danaNumber}
          onChangeText={setDanaNumber}
          placeholder="08xxxxxxxxxx"
          placeholderTextColor={theme.faint}
          keyboardType="phone-pad"
        />
        {danaNumber && !validDana && <Text style={styles.hintError}>Format nomor DANA tidak valid (08xxxxxxxxxx)</Text>}
        <Button
          title="KONFIRMASI PENUKARAN"
          size="lg"
          disabled={!canConfirm}
          loading={submitting}
          onPress={() => setConfirmVisible(true)}
          style={{ marginTop: 16 }}
        />
        <View style={styles.warnBox}>
          <Text style={styles.warnText}>💡 Nominal tetap, tidak bisa diisi manual. Penukaran bersifat atomic — jika payout DANA gagal, poin dikembalikan otomatis.</Text>
        </View>
      </ScrollView>
      <ConfirmModal
        visible={confirmVisible}
        title="Konfirmasi Penukaran"
        confirmText="TUKAR"
        danger
        onCancel={() => setConfirmVisible(false)}
        onConfirm={confirm}
        body={
          <View>
            <Row label="Nominal" value={selected ? fmtRp(selected.amount) : '-'} />
            <Row label="Poin" value={selected ? fmtPts(selected.points) : '-'} />
            <Row label="DANA" value={danaNumber} />
            <Text style={styles.confirmWarn}>Apakah Anda yakin?</Text>
          </View>
        }
      />
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.bg },
  topbar: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary, paddingHorizontal: 16, paddingTop: 48, paddingBottom: 14, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  backText: { fontSize: 18, color: '#fff' },
  topTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  balanceCard: { backgroundColor: theme.dark, borderRadius: 16, padding: 20, marginBottom: 18, alignItems: 'center' },
  balanceLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  balancePts: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 4 },
  balanceRp: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginTop: 8, marginBottom: 10 },
  denomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  denomCard: { width: '48%', flexGrow: 1, backgroundColor: theme.surface, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 2, borderColor: theme.border, position: 'relative' },
  denomDisabled: { opacity: 0.5, backgroundColor: theme.border },
  denomSelected: { borderColor: theme.primary, backgroundColor: theme.primary },
  denomRp: { fontSize: 18, fontWeight: '800', color: theme.text },
  denomPts: { fontSize: 12, color: theme.muted, marginTop: 4 },
  denomLock: { position: 'absolute', top: 8, right: 8, fontSize: 12 },
  input: { borderWidth: 1.5, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: theme.text },
  inputError: { borderColor: theme.danger },
  hintError: { fontSize: 12, color: theme.danger, marginTop: 4 },
  warnBox: { backgroundColor: theme.primaryLight, borderRadius: 8, padding: 12, marginTop: 14 },
  warnText: { fontSize: 12, color: theme.primaryDark, lineHeight: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowLabel: { fontSize: 14, color: theme.muted },
  rowVal: { fontSize: 14, fontWeight: '600' },
  confirmWarn: { fontSize: 13, color: theme.muted, marginTop: 8, textAlign: 'center', fontStyle: 'italic' },
});
