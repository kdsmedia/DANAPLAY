import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { API } from '../../../src/api';
import { theme, fmtPts, fmtDate } from '../../../src/utils';
import { Card, Button, Badge, Progress, Loading, EmptyState } from '../../../src/components';

export default function ProgressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try { setData(await API.campaigns.myDetail(id)); } catch {} finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { load(); }, [id]);

  if (loading) return <View style={styles.flex}><Loading label="Memuat progress..." /></View>;
  if (!data) return <View style={styles.flex}><EmptyState icon="❌" title="Campaign tidak ditemukan" /></View>;

  const { campaign, enrollment } = data;
  const cu = enrollment;
  if (!cu) {
    return (
      <View style={styles.flex}>
        <View style={styles.topbar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>←</Text></TouchableOpacity>
          <Text style={styles.topTitle}>{campaign.title}</Text>
        </View>
        <EmptyState icon="🚫" title="Anda belum mengikuti campaign ini" sub="Klik Download di halaman campaign untuk mulai" />
        <View style={{ paddingHorizontal: 16 }}><Button title="Lihat Campaign" onPress={() => router.replace(`/campaign/${id}`)} /></View>
      </View>
    );
  }

  const remaining = campaign.required_days - cu.active_days;
  const nextMs = campaign.milestones.find((m: any) => !cu.milestones_paid.includes(m.milestone_id));

  return (
    <View style={styles.flex}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>←</Text></TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{campaign.title}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />}>
        <Card style={styles.headerCard}>
          <Text style={styles.bigIcon}>{campaign.icon || '🎮'}</Text>
          <Text style={styles.campTitle}>{campaign.title}</Text>
          <View style={{ marginTop: 10 }}><Badge status={cu.status} /></View>
        </Card>
        <Card>
          <View style={styles.progressHead}>
            <Text style={styles.cardTitle}>PROGRESS</Text>
            <Text style={styles.progressCount}>{cu.active_days} / {campaign.required_days} Hari</Text>
          </View>
          <Progress value={cu.active_days} total={campaign.required_days} />
          {cu.status === 'ACTIVE' && <Text style={styles.remaining}>Sisa {remaining} hari lagi</Text>}
        </Card>
        <Card>
          <Text style={styles.cardTitle}>STATUS PERSYARATAN</Text>
          <StatusRow label="Install" done={!!cu.install_at} date={cu.install_at} />
          <StatusRow label="First Open" done={!!cu.first_open_at} date={cu.first_open_at} />
          <StatusRow label="Hari aktif" done={cu.active_days >= campaign.required_days} value={`${cu.active_days}/${campaign.required_days}`} />
          {cu.last_event_at && <StatusRow label="Event terakhir" done value={fmtDate(cu.last_event_at)} />}
        </Card>
        <Card>
          <Text style={styles.cardTitle}>KALENDER AKTIVITAS</Text>
          <View style={styles.dayGrid}>
            {Array.from({ length: campaign.required_days }, (_, i) => {
              const day = i + 1;
              const done = day <= cu.active_days;
              return (
                <View key={day} style={[styles.dayCell, done && styles.dayCellDone]}>
                  <Text style={[styles.dayText, done && styles.dayTextDone]}>{day}</Text>
                </View>
              );
            })}
          </View>
        </Card>
        <Card>
          <Text style={styles.cardTitle}>MILESTONE & REWARD</Text>
          {campaign.milestones.map((m: any) => {
            const paid = cu.milestones_paid.includes(m.milestone_id);
            return (
              <View key={m.milestone_id} style={[styles.msRow, !paid && { opacity: 0.6 }]}>
                <View style={[styles.msIc, { backgroundColor: paid ? theme.successBg : theme.border }]}><Text>{paid ? '✓' : '○'}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.msLabel}>{m.label}</Text>
                  <Text style={styles.msDay}>{m.day === 0 ? 'Install' : 'Hari ke-' + m.day}</Text>
                </View>
                <Text style={[styles.msReward, { color: paid ? theme.success : theme.faint }]}>+{fmtPts(m.reward_points)}</Text>
              </View>
            );
          })}
        </Card>
        {cu.status === 'ACTIVE' && nextMs && (
          <View style={styles.nextBox}>
            <Text style={styles.nextLabel}>REWARD BERIKUTNYA</Text>
            <Text style={styles.nextReward}>+{fmtPts(nextMs.reward_points)} poin</Text>
            <Text style={styles.nextDay}>{nextMs.day === 0 ? 'Install' : 'Hari ke-' + nextMs.day}</Text>
          </View>
        )}
        {cu.status === 'COMPLETED' && (
          <View style={[styles.nextBox, { backgroundColor: theme.successBg, borderColor: theme.success }]}>
            <Text style={[styles.nextLabel, { color: theme.success }]}>🎉 CAMPAGIN SELESAI</Text>
            <Text style={styles.nextReward}>Semua reward telah diberikan</Text>
          </View>
        )}
        {cu.status === 'FAILED' && (
          <View style={[styles.nextBox, { backgroundColor: theme.dangerBg, borderColor: theme.danger }]}>
            <Text style={[styles.nextLabel, { color: theme.danger }]}>❌ CAMPAGIN GAGAL</Text>
            <Text style={styles.nextReward}>Reward penyelesaian tidak diberikan</Text>
            {cu.failure_reason && <Text style={styles.failReason}>{cu.failure_reason}</Text>}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatusRow({ label, done, date, value }: { label: string; done: boolean; date?: string | null; value?: string }) {
  return (
    <View style={styles.statusRow}>
      <View style={[styles.statusDot, done ? styles.statusDotDone : styles.statusDotPending]} />
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusVal, { color: done ? theme.success : theme.faint }]}>{value || (date ? fmtDate(date) : done ? '✓' : '○')}</Text>
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
  bigIcon: { fontSize: 56 },
  campTitle: { fontSize: 20, fontWeight: '800', marginTop: 6 },
  cardTitle: { fontSize: 12, fontWeight: '700', color: theme.muted, letterSpacing: 0.5 },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progressCount: { fontSize: 15, fontWeight: '700', color: theme.text },
  remaining: { fontSize: 12, color: theme.muted, marginTop: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusDotDone: { backgroundColor: theme.success },
  statusDotPending: { backgroundColor: theme.border },
  statusLabel: { flex: 1, fontSize: 14 },
  statusVal: { fontSize: 13, fontWeight: '600' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  dayCell: { width: 38, height: 38, borderRadius: 10, backgroundColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  dayCellDone: { backgroundColor: theme.primary },
  dayText: { fontSize: 13, fontWeight: '600', color: theme.muted },
  dayTextDone: { color: '#fff' },
  msRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 12 },
  msIc: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  msLabel: { fontSize: 14, fontWeight: '600' },
  msDay: { fontSize: 12, color: theme.faint, marginTop: 2 },
  msReward: { fontSize: 14, fontWeight: '700' },
  nextBox: { backgroundColor: theme.primaryLight, borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 4, borderWidth: 1.5, borderColor: theme.primary },
  nextLabel: { fontSize: 12, fontWeight: '700', color: theme.primary, letterSpacing: 0.5 },
  nextReward: { fontSize: 18, fontWeight: '800', color: theme.text, marginTop: 4 },
  nextDay: { fontSize: 12, color: theme.muted, marginTop: 2 },
  failReason: { fontSize: 12, color: theme.danger, marginTop: 4, textAlign: 'center' },
});
