import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { API } from '../src/api';
import { useAuth } from '../src/auth';
import { theme, timeAgo } from '../src/utils';
import { Card, EmptyState, Loading } from '../src/components';

const iconMap: Record<string, string> = {
  campaign_completed: '🎉',
  reward_earned: '⭐',
  milestone_reached: '🏆',
  campaign_failed: '❌',
  withdrawal_completed: '💸',
  withdrawal_failed: '⚠️',
  refund: '↩️',
  referral: '👥',
  campaign_active: '🔥',
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { refreshUnread } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await API.notifications.list();
      setItems(data.items || []);
      refreshUnread();
    } catch {} finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
    try { await API.notifications.markRead(id); refreshUnread(); } catch {}
  };

  return (
    <View style={styles.flex}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>←</Text></TouchableOpacity>
        <Text style={styles.topTitle}>Notifikasi</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />}>
        {loading ? <Loading /> : items.length === 0 ? <EmptyState icon="🔔" title="Belum ada notifikasi" sub="Notifikasi akan muncul di sini" /> : (
          <Card>
            {items.map((n, i) => (
              <TouchableOpacity
                key={n.id}
                style={[styles.item, !n.is_read && styles.itemUnread, i === items.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => !n.is_read && markRead(n.id)}
              >
                <View style={[styles.itemIc, { backgroundColor: n.is_read ? theme.border : theme.primaryLight }]}>
                  <Text style={{ fontSize: 16 }}>{iconMap[n.type] || '🔔'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, !n.is_read && { fontWeight: '700' }]}>{n.title}</Text>
                  <Text style={styles.itemBody} numberOfLines={2}>{n.body}</Text>
                  <Text style={styles.itemDate}>{timeAgo(n.created_at)}</Text>
                </View>
                {!n.is_read && <View style={styles.dot} />}
              </TouchableOpacity>
            ))}
          </Card>
        )}
      </ScrollView>
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
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 12 },
  itemUnread: { backgroundColor: theme.primaryLight, marginHorizontal: -16, paddingHorizontal: 16, marginLeft: 0, marginRight: 0 },
  itemIc: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 14, fontWeight: '600', color: theme.text },
  itemBody: { fontSize: 13, color: theme.muted, marginTop: 2, lineHeight: 18 },
  itemDate: { fontSize: 11, color: theme.faint, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary },
});
