import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth';
import { API } from '../../src/api';
import { theme, fmtPts, fmtRp } from '../../src/utils';
import { Card, Button, Badge, Progress, EmptyState, Loading } from '../../src/components';
import { AdViewer } from '../../src/AdViewer';

export default function HomeScreen() {
  const { user, balance, refreshBalance } = useAuth();
  const router = useRouter();
  const [active, setActive] = useState<any[]>([]);
  const [available, setAvailable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adProgress, setAdProgress] = useState<any>(null);
  const [adModal, setAdModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, c, ad] = await Promise.all([API.campaigns.myActive(), API.campaigns.list(), API.ads.dailyProgress()]);
      setActive((a.items || []).filter((x) => ['CLICKED', 'INSTALLED', 'ACTIVE'].includes(x.status)).slice(0, 2));
      const enrolled = new Set((a.items || []).map((x) => x.campaign_id));
      setAvailable((c.items || []).filter((x) => !enrolled.has(x.id)).slice(0, 3));
      setAdProgress(ad);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); refreshBalance(); }, [load, refreshBalance]);

  const onRefresh = () => { setRefreshing(true); load(); refreshBalance(); };

  const adPct = adProgress ? Math.round((adProgress.completedToday / adProgress.limit) * 100) : 0;

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
        {adProgress && (
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Tugas Harian</Text>
            <Text style={styles.seeAll}>{adProgress.completedToday}/{adProgress.limit} hari ini</Text>
          </View>
        )}
        {adProgress && (
          <TouchableOpacity onPress={() => adProgress.remaining > 0 && setAdModal(true)} disabled={adProgress.remaining === 0}>
            <Card style={styles.adCard}>
              <View style={styles.adCardTop}>
                <Text style={styles.adIcon}>📺</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.adCardTitle}>Tonton Iklan</Text>
                  <Text style={styles.adCardSub}>1x tonton = ⭐ {fmtPts(adProgress.rewardPerView)} poin · max {adProgress.limit}x/hari</Text>
                </View>
                {adProgress.remaining > 0 ? (
                  <View style={styles.adPlayBtn}><Text style={styles.adPlayTxt}>▶</Text></View>
                ) : (
                  <View style={[styles.adPlayBtn, styles.adPlayDone]}><Text style={styles.adPlayTxt}>✓</Text></View>
                )}
              </View>
              <View style={styles.adProgressRow}>
                <Progress value={adProgress.completedToday} total={adProgress.limit} />
              </View>
              <View style={styles.adEarnedRow}>
                <Text style={styles.adEarnedLabel}>Hari ini terkumpul</Text>
                <Text style={styles.adEarnedVal}>⭐ {fmtPts(adProgress.earnedToday)} poin</Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}
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
      <AdViewer
        visible={adModal}
        onClose={() => setAdModal(false)}
        onRewarded={async () => { await refreshBalance(); const ad = await API.ads.dailyProgress(); setAdProgress(ad); }}
      />
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
  adCard: { padding: 16 },
  adCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  adIcon: { fontSize: 28 },
  adCardTitle: { fontSize: 15, fontWeight: '700', color: theme.text },
  adCardSub: { fontSize: 11, color: theme.muted, marginTop: 2 },
  adPlayBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  adPlayDone: { backgroundColor: theme.success },
  adPlayTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  adProgressRow: { marginTop: 14 },
  adEarnedRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  adEarnedLabel: { fontSize: 12, color: theme.muted },
  adEarnedVal: { fontSize: 13, fontWeight: '700', color: theme.success },
});
