import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { API } from '../src/api';
import { theme } from '../src/utils';
import { Card, Badge, Progress, EmptyState, Loading } from '../src/components';

export default function MyCampaignsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'active' | 'completed' | 'failed'>('active');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await API.campaigns.myActive();
      const all = data.items || [];
      const filtered = all.filter((x) => {
        if (tab === 'active') return ['CLICKED', 'INSTALLED', 'ACTIVE'].includes(x.status);
        if (tab === 'completed') return x.status === 'COMPLETED';
        return x.status === 'FAILED';
      });
      setItems(filtered);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [tab]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  return (
    <View style={styles.flex}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>←</Text></TouchableOpacity>
        <Text style={styles.topTitle}>Campaign Saya</Text>
      </View>
      <View style={styles.tabs}>
        <TabBtn label="Aktif" active={tab === 'active'} onPress={() => setTab('active')} />
        <TabBtn label="Selesai" active={tab === 'completed'} onPress={() => setTab('completed')} />
        <TabBtn label="Gagal" active={tab === 'failed'} onPress={() => setTab('failed')} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />}>
        {loading ? <Loading /> : items.length === 0 ? (
          <EmptyState icon="📭" title={`Tidak ada campaign ${tab}`} sub={tab === 'active' ? 'Mulai dari tab Campaign' : ''} />
        ) : items.map((c) => (
          <TouchableOpacity key={c.id} onPress={() => router.push(`/campaign/${c.id}/progress`)}>
            <Card>
              <View style={styles.row}>
                <Text style={styles.icon}>{c.icon || '🎮'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{c.title}</Text>
                  <View style={{ marginTop: 6 }}><Badge status={c.status} /></View>
                </View>
              </View>
              {['ACTIVE', 'INSTALLED'].includes(c.status) && (
                <View style={{ marginTop: 12 }}>
                  <View style={styles.progressLabel}>
                    <Text style={styles.progressText}>{c.active_days} / {c.required_days} hari</Text>
                  </View>
                  <Progress value={c.active_days} total={c.required_days} />
                </View>
              )}
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.bg },
  topbar: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary, paddingHorizontal: 16, paddingTop: 48, paddingBottom: 14, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  backText: { fontSize: 18, color: '#fff' },
  topTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, backgroundColor: theme.surface, borderRadius: 99, padding: 4, shadowColor: '#101C3C', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 99, alignItems: 'center' },
  tabActive: { backgroundColor: theme.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: theme.muted },
  tabTextActive: { color: '#fff' },
  scroll: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { fontSize: 26 },
  title: { fontSize: 15, fontWeight: '700', color: theme.text },
  progressLabel: { marginBottom: 6 },
  progressText: { fontSize: 12, color: theme.muted },
});
