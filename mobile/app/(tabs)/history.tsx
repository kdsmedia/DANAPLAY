import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { API } from '../../src/api';
import { theme, fmtPts, fmtRp, fmtDateTime } from '../../src/utils';
import { Card, Badge, EmptyState, Loading } from '../../src/components';

export default function HistoryScreen() {
  const [tab, setTab] = useState<'points' | 'withdrawals'>('points');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = tab === 'points' ? await API.points.transactions(100) : await API.withdrawals.list(50);
      setItems(data.items || []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [tab]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const txIcon: Record<string, string> = { EARN: '⭐', BONUS: '🎁', REFERRAL: '👥', REDEEM: '💸', REFUND: '↩️', ADJUSTMENT: '⚙️', EXPIRED: '⌛' };

  return (
    <View style={styles.flex}>
      <View style={styles.topbar}>
        <Text style={styles.topTitle}>Riwayat</Text>
      </View>
      <View style={styles.tabs}>
        <TabBtn label="Riwayat Poin" active={tab === 'points'} onPress={() => setTab('points')} />
        <TabBtn label="Penarikan" active={tab === 'withdrawals'} onPress={() => setTab('withdrawals')} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />}>
        {loading ? <Loading /> : items.length === 0 ? (
          <EmptyState icon={tab === 'points' ? '📋' : '💸'} title={tab === 'points' ? 'Belum ada riwayat poin' : 'Belum ada penarikan'} />
        ) : (
          <Card>
            {tab === 'points' ? items.map((t, i) => {
              const pos = t.amount > 0;
              return (
                <View key={t.id} style={[styles.txItem, i === items.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[styles.txIc, { backgroundColor: pos ? theme.successBg : theme.dangerBg }]}>
                    <Text style={{ fontSize: 16 }}>{txIcon[t.type] || '•'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txTitle} numberOfLines={1}>{t.description}</Text>
                    <Text style={styles.txDate}>{fmtDateTime(t.created_at)} · {t.type}</Text>
                  </View>
                  <Text style={[styles.txAmt, { color: pos ? theme.success : theme.text }]}>{pos ? '+' : ''}{fmtPts(t.amount)}</Text>
                </View>
              );
            }) : items.map((w, i) => (
              <View key={w.id} style={[styles.txItem, i === items.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={[styles.txIc, { backgroundColor: theme.primaryLight }]}>
                  <Text style={{ fontSize: 16 }}>💸</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txTitle}>{fmtRp(w.amount)} · DANA</Text>
                  <Text style={styles.txDate}>{fmtPts(w.points)} poin · {fmtDateTime(w.created_at)}</Text>
                  {w.failure_reason ? <Text style={styles.txFail} numberOfLines={1}>{w.failure_reason}</Text> : null}
                </View>
                <Badge status={w.status} />
              </View>
            ))}
          </Card>
        )}
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
  topbar: { backgroundColor: theme.primary, paddingHorizontal: 16, paddingTop: 48, paddingBottom: 14, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  topTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, backgroundColor: theme.surface, borderRadius: 99, padding: 4, shadowColor: '#101C3C', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 99, alignItems: 'center' },
  tabActive: { backgroundColor: theme.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: theme.muted },
  tabTextActive: { color: '#fff' },
  scroll: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40 },
  txItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  txIc: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  txTitle: { fontSize: 14, fontWeight: '600', color: theme.text },
  txDate: { fontSize: 12, color: theme.faint, marginTop: 2 },
  txFail: { fontSize: 11, color: theme.danger, marginTop: 2 },
  txAmt: { fontSize: 14, fontWeight: '700' },
});
