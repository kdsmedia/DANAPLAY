import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth';
import { API } from '../../src/api';
import { theme, fmtPts, fmtRp } from '../../src/utils';
import { Card, Button, Badge, Progress, EmptyState, Loading } from '../../src/components';

export default function HomeScreen() {
  const { user, balance, refreshBalance } = useAuth();
  const router = useRouter();
  const [active, setActive] = useState<any[]>([]);
  const [available, setAvailable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, c] = await Promise.all([API.campaigns.myActive(), API.campaigns.list()]);
      setActive((a.items || []).filter((x) => ['CLICKED', 'INSTALLED', 'ACTIVE'].includes(x.status)).slice(0, 2));
      const enrolled = new Set((a.items || []).map((x) => x.campaign_id));
      setAvailable((c.items || []).filter((x) => !enrolled.has(x.id)).slice(0, 3));
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); refreshBalance(); }, [load, refreshBalance]);

  const onRefresh = () => { setRefreshing(true); load(); refreshBalance(); };

  return (
    <View style={styles.flex}>
      <View style={styles.topbar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Halo, {user?.name || 'User'}</Text>
          <Text style={styles.welcome}>Selamat datang di DANAPLAY 🎮</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.bell}>
          <Text style={{ fontSize: 18 }}>🔔</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>SALDO POIN</Text>
        <Text style={styles.balancePoints}>⭐ {fmtPts(balance?.points || user?.points_balance || 0)} Poin</Text>
        <Text style={styles.balanceRp}>Nilai: {fmtRp(balance?.rupiah || Math.floor((user?.points_balance || 0) / 1000))}</Text>
        <View style={styles.balanceActions}>
          <Button title="TUKAR" variant="ghost" style={{ flex: 1, marginRight: 8 }} onPress={() => router.push('/redeem')} />
          <Button title="CAMPAIGN" style={{ flex: 1 }} onPress={() => router.push('/(tabs)/campaigns')} />
        </View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Campaign Aktif</Text>
          <TouchableOpacity onPress={() => router.push('/my-campaigns')}><Text style={styles.seeAll}>Lihat semua</Text></TouchableOpacity>
        </View>
        {loading ? <Loading /> : active.length === 0 ? <EmptyState icon="📭" title="Belum ada campaign aktif" sub="Mulai campaign untuk kumpulkan poin" /> : active.map((c) => (
          <TouchableOpacity key={c.id} onPress={() => router.push(`/campaign/${c.id}/progress`)}>
            <Card>
              <View style={styles.activeRow}>
                <Text style={styles.campIcon}>{c.icon || '🎮'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.campTitle}>{c.title}</Text>
                  <Badge status={c.status} />
                </View>
              </View>
              <View style={{ marginTop: 12 }}>
                <View style={styles.progressLabel}>
                  <Text style={styles.progressText}>Progress</Text>
                  <Text style={styles.progressText}>{c.active_days} / {c.required_days} hari</Text>
                </View>
                <Progress value={c.active_days} total={c.required_days} />
              </View>
            </Card>
          </TouchableOpacity>
        ))}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Campaign Tersedia</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/campaigns')}><Text style={styles.seeAll}>Lihat semua</Text></TouchableOpacity>
        </View>
        {loading ? <Loading /> : available.length === 0 ? <EmptyState icon="🎉" title="Semua campaign sudah diikuti" /> : available.map((c) => (
          <TouchableOpacity key={c.id} onPress={() => router.push(`/campaign/${c.id}`)}>
            <Card style={styles.campCard}>
              <Text style={styles.campIcon}>{c.icon || '🎮'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.campTitle}>{c.title}</Text>
                <Text style={styles.campMeta}>{c.required_days} hari · {c.milestones.length} milestone</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.campReward}>{fmtPts(c.reward_total)}</Text>
                <Text style={styles.campRewardSub}>Total Reward</Text>
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.bg },
  topbar: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary, paddingHorizontal: 16, paddingTop: 48, paddingBottom: 14, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  hello: { fontSize: 20, fontWeight: '700', color: '#fff' },
  welcome: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  bell: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  balanceCard: { marginHorizontal: 16, marginTop: -8, backgroundColor: theme.dark, borderRadius: 22, padding: 20, shadowColor: '#101C3C', shadowOpacity: 0.12, shadowRadius: 30, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  balanceLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  balancePoints: { fontSize: 28, fontWeight: '800', color: '#fff', marginVertical: 4 },
  balanceRp: { fontSize: 15, color: 'rgba(255,255,255,0.9)' },
  balanceActions: { flexDirection: 'row', marginTop: 16 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 40 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: theme.text },
  seeAll: { fontSize: 13, fontWeight: '600', color: theme.primary },
  campIcon: { fontSize: 26 },
  campCard: { flexDirection: 'row', alignItems: 'center' },
  campTitle: { fontSize: 15, fontWeight: '700', color: theme.text },
  campMeta: { fontSize: 12, color: theme.muted, marginTop: 2 },
  campReward: { fontSize: 13, fontWeight: '700', color: theme.primary },
  campRewardSub: { fontSize: 10, color: theme.faint },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { fontSize: 12, color: theme.muted },
});
