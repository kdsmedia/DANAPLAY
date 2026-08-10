import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { API } from '../../../src/api';
import { theme, fmtPts } from '../../../src/utils';
import { Card, Button, Badge, Loading, EmptyState } from '../../../src/components';

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clicking, setClicking] = useState(false);

  useEffect(() => {
    (async () => {
      try { setData(await API.campaigns.get(id)); } catch {} finally { setLoading(false); }
    })();
  }, [id]);

  const download = async () => {
    setClicking(true);
    try {
      const res = await API.campaigns.click(id);
      Alert.alert('📱 Lanjut ke Google Play', 'Install aplikasi dan buka untuk mulai campaign. Tracking session aktif. Jangan uninstall sebelum campaign selesai.', [
        { text: 'Lihat Progress', onPress: () => router.replace(`/campaign/${id}/progress`) },
        { text: 'Buka Google Play', onPress: () => { if (res.redirectUrl) Linking.openURL(res.redirectUrl); } },
      ]);
    } catch (e: any) { Alert.alert('Gagal', e.message); } finally { setClicking(false); }
  };

  if (loading) return <View style={styles.flex}><Loading label="Memuat campaign..." /></View>;
  if (!data) return <View style={styles.flex}><EmptyState icon="❌" title="Campaign tidak ditemukan" /></View>;

  const { campaign, enrollment } = data;
  const enrolled = enrollment && ['ACTIVE', 'COMPLETED', 'FAILED'].includes(enrollment.status);

  return (
    <View style={styles.flex}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>←</Text></TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{campaign.title}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.headerCard}>
          <Text style={styles.bigIcon}>{campaign.icon || '🎮'}</Text>
          <Text style={styles.campTitle}>{campaign.title}</Text>
          <Text style={styles.campDesc}>{campaign.description}</Text>
        </Card>
        <View style={styles.rewardCard}>
          <Text style={styles.rewardLabel}>⭐ TOTAL REWARD</Text>
          <Text style={styles.rewardPts}>{fmtPts(campaign.reward_total)} Poin</Text>
        </View>
        <Card>
          <Text style={styles.cardTitle}>PERSYARATAN</Text>
          {[
            { label: 'Install aplikasi', done: enrollment && ['INSTALLED', 'ACTIVE', 'COMPLETED'].includes(enrollment.status) },
            { label: 'Buka aplikasi (first open)', done: enrollment && enrollment.first_open_at },
            { label: `Main selama ${campaign.required_days} hari`, done: enrollment && enrollment.active_days >= campaign.required_days },
            { label: 'Jangan uninstall sebelum selesai', done: false },
          ].map((r, i) => (
            <View key={i} style={styles.reqRow}>
              <View style={[styles.chk, r.done ? styles.chkDone : styles.chkPending]}>
                <Text style={styles.chkText}>{r.done ? '✓' : '○'}</Text>
              </View>
              <Text style={styles.reqText}>{r.label}</Text>
            </View>
          ))}
        </Card>
        <Card>
          <Text style={styles.cardTitle}>DURASI</Text>
          <Text style={styles.duration}>{campaign.required_days} Hari</Text>
        </Card>
        <Card>
          <Text style={styles.cardTitle}>REWARD BERTAHAP</Text>
          {campaign.milestones.map((m: any) => (
            <View key={m.milestone_id} style={styles.msRow}>
              <View style={[styles.msIc, { backgroundColor: theme.primaryLight }]}><Text>{m.day === 0 ? '📥' : '📅'}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.msLabel}>{m.label}</Text>
                <Text style={styles.msDay}>{m.day === 0 ? 'Install' : 'Hari ke-' + m.day}</Text>
              </View>
              <Text style={styles.msReward}>+{fmtPts(m.reward_points)}</Text>
            </View>
          ))}
        </Card>
        <View style={styles.warnBox}>
          <Text style={styles.warnText}>⚠️ PENTING: Anda harus mempertahankan aktivitas sesuai persyaratan sampai hari ke-{campaign.required_days}. Jika campaign dinyatakan gagal oleh sistem attribution, reward penyelesaian tidak diberikan.</Text>
        </View>
        {enrolled ? (
          <Button title="Lihat Progress" size="lg" onPress={() => router.push(`/campaign/${id}/progress`)} />
        ) : (
          <Button title="DOWNLOAD" size="lg" onPress={download} loading={clicking} />
        )}
        {enrollment && <View style={{ alignItems: 'center', marginTop: 10 }}><Badge status={enrollment.status} /></View>}
        <Text style={styles.note}>Reward tidak diberikan hanya karena klik download. Install & aktivitas diverifikasi via attribution.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.bg },
  topbar: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary, paddingHorizontal: 16, paddingTop: 48, paddingBottom: 14, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  backText: { fontSize: 18, color: '#fff' },
  topTitle: { fontSize: 18, fontWeight: '700', color: '#fff', flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  headerCard: { alignItems: 'center', paddingVertical: 24 },
  bigIcon: { fontSize: 64 },
  campTitle: { fontSize: 22, fontWeight: '800', marginTop: 8 },
  campDesc: { fontSize: 13, color: theme.muted, marginTop: 6, textAlign: 'center' },
  rewardCard: { backgroundColor: theme.primary, borderRadius: 16, padding: 20, marginBottom: 14, alignItems: 'center' },
  rewardLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)', letterSpacing: 1 },
  rewardPts: { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 4 },
  cardTitle: { fontSize: 12, fontWeight: '700', color: theme.muted, letterSpacing: 0.5, marginBottom: 10 },
  reqRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  chk: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  chkDone: { backgroundColor: theme.successBg },
  chkPending: { backgroundColor: theme.border },
  chkText: { fontSize: 12 },
  reqText: { fontSize: 14, flex: 1 },
  duration: { fontSize: 24, fontWeight: '800' },
  msRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 12 },
  msIc: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  msLabel: { fontSize: 14, fontWeight: '600' },
  msDay: { fontSize: 12, color: theme.faint, marginTop: 2 },
  msReward: { fontSize: 14, fontWeight: '700', color: theme.success },
  warnBox: { backgroundColor: theme.warningBg, borderLeftWidth: 3, borderLeftColor: theme.warning, padding: 12, borderRadius: 8, marginBottom: 14 },
  warnText: { fontSize: 13, color: '#8a5a00', lineHeight: 19 },
  note: { fontSize: 12, color: theme.faint, textAlign: 'center', marginTop: 10, lineHeight: 18 },
});
