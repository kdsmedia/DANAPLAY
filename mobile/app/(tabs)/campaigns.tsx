import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { API } from '../../src/api';
import { theme, fmtPts } from '../../src/utils';
import { Card, Badge, Progress, EmptyState, Loading } from '../../src/components';

export default function CampaignsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'available' | 'active'>('available');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      if (tab === 'available') {
        const [camps, active] = await Promise.all([API.campaigns.list(), API.campaigns.myActive()]);
        const enrolled = new Set((active.items || []).map((x) => x.campaign_id));
        setItems((camps.items || []).filter((x) => !enrolled.has(x.id)));
      } else {
        const active = await API.campaigns.myActive();
        setItems((active.items || []).filter((x) => ['CLICKED', 'INSTALLED', 'ACTIVE'].includes(x.status)));
      }
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [tab]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  return (
    <View style={styles.flex}>
      <View style={styles.topbar}>
        <Text style={styles.topTitle}>Campaign</Text>
        <Text style={styles.topSub}>Pilih campaign & dapatkan reward</Text>
      </View>
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'available' && styles.tabActive]} onPress={() => setTab('available')}>
          <Text style={[styles.tabText, tab === 'available' && styles.tabTextActive]}>Tersedia</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'active' && styles.tabActive]} onPress={() => setTab('active')}>
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>Aktif Saya</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />}>
        {loading ? <Loading /> : items.length === 0 ? (
          <EmptyState icon={tab === 'available' ? '🎉' : '📭'} title={tab === 'available' ? 'Tidak ada campaign tersedia' : 'Belum ada campaign aktif'} sub={tab === 'available' ? 'Coba lagi nanti' : 'Mulai dari tab Tersedia'} />
        ) : items.map((c) => {
          const isActive = ['CLICKED', 'INSTALLED', 'ACTIVE'].includes(c.status);
          return (
            <TouchableOpacity key={c.id} onPress={() => router.push(isActive ? `/campaign/${c.id}/progress` : `/campaign/${c.id}`)}>
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.icon}>{c.icon || '🎮'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{c.title}</Text>
                    {isActive ? <View style={{ marginTop: 6 }}><Badge status={c.status} /></View> : <Text style={styles.meta}>{c.required_days} hari · {c.milestones.length} milestone</Text>}
                  </View>
                  {!isActive && <View style={{ alignItems: 'flex-end' }}><Text style={styles.reward}>{fmtPts(c.reward_total)}</Text><Text style={styles.rewardSub}>Total</Text></View>}
                </View>
                {isActive && (
                  <View style={{ marginTop: 12 }}>
                    <View style={styles.progressLabel}><Text style={styles.progressText}>Progress</Text><Text style={styles.progressText}>{c.active_days}/{c.required_days} hari</Text></View>
                    <Progress value={c.active_days} total={c.required_days} />
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.bg },
  topbar: { backgroundColor: theme.primary, paddingHorizontal: 16, paddingTop: 48, paddingBottom: 14, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  topTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  topSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, backgroundColor: theme.surface, borderRadius: 99, padding: 4, shadowColor: '#101C3C', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 99, alignItems: 'center' },
  tabActive: { backgroundColor: theme.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: theme.muted },
  tabTextActive: { color: '#fff' },
  scroll: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40 },
  card: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  icon: { fontSize: 26 },
  title: { fontSize: 15, fontWeight: '700', color: theme.text },
  meta: { fontSize: 12, color: theme.muted, marginTop: 2 },
  reward: { fontSize: 13, fontWeight: '700', color: theme.primary },
  rewardSub: { fontSize: 10, color: theme.faint },
  progressLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { fontSize: 12, color: theme.muted },
});
