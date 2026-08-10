import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Clipboard } from 'react-native';
import { API } from '../../src/api';
import { useAuth } from '../../src/auth';
import { theme, fmtDate } from '../../src/utils';
import { Card, Badge, EmptyState, Loading } from '../../src/components';

export default function ReferralScreen() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try { setData(await API.referrals.list()); } catch {} finally { setLoading(false); }
    })();
  }, []);

  const code = user?.referral_code || '';
  const shareText = `Gabung DANAPLAY dengan kode referral saya: ${code}`;

  const copy = async () => {
    try { await Clipboard.setString(code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  const share = async () => {
    try { await Share.share({ title: 'DANAPLAY', message: shareText }); } catch {}
  };

  if (loading) return <View style={styles.flex}><View style={styles.topbar} /><Loading /></View>;

  return (
    <View style={styles.flex}>
      <View style={styles.topbar}><Text style={styles.topTitle}>Referral</Text></View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.codeCard}>
          <Text style={styles.codeLabel}>Kode Referral Anda</Text>
          <Text style={styles.code}>{code}</Text>
          <View style={styles.codeActions}>
            <TouchableOpacity style={styles.codeBtnOutline} onPress={copy}>
              <Text style={styles.codeBtnOutlineText}>{copied ? '✓ Disalin' : 'Salin Kode'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.codeBtnPrimary} onPress={share}>
              <Text style={styles.codeBtnPrimaryText}>Bagikan</Text>
            </TouchableOpacity>
          </View>
        </Card>
        <View style={styles.warnBox}>
          <Text style={styles.warnText}>🎁 Bonus referral hanya diberikan setelah teman yang Anda ajak menyelesaikan campaign pertama mereka. Sistem mencegah self-referral & akun ganda.</Text>
        </View>
        {data && (
          <>
            <Card>
              <Text style={styles.cardTitle}>STATISTIK</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}><Text style={styles.statVal}>{data.stats.total}</Text><Text style={styles.statLabel}>Total</Text></View>
                <View style={styles.statItem}><Text style={[styles.statVal, { color: theme.success }]}>{data.stats.paid}</Text><Text style={styles.statLabel}>Berbayar</Text></View>
                <View style={styles.statItem}><Text style={[styles.statVal, { color: theme.warning }]}>{data.stats.pending + data.stats.qualified}</Text><Text style={styles.statLabel}>Pending</Text></View>
              </View>
            </Card>
            <Text style={styles.sectionTitle}>Teman yang Diajak</Text>
            {data.referrals.length === 0 ? <EmptyState icon="👥" title="Belum ada referral" sub="Bagikan kode Anda untuk mulai" /> : (
              <Card>
                {data.referrals.map((r: any, i: number) => (
                  <View key={r.id} style={[styles.txItem, i === data.referrals.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={styles.txIc}><Text>👤</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txTitle}>{r.invitee_name}</Text>
                      <Text style={styles.txDate}>{fmtDate(r.created_at)}</Text>
                    </View>
                    <Badge status={r.status === 'BONUS_PAID' ? 'COMPLETED' : 'PENDING'} />
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.bg },
  topbar: { backgroundColor: theme.primary, paddingHorizontal: 16, paddingTop: 48, paddingBottom: 14, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  topTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  scroll: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 40 },
  codeCard: { alignItems: 'center', paddingVertical: 24 },
  codeLabel: { fontSize: 12, color: theme.muted, fontWeight: '600' },
  code: { fontSize: 32, fontWeight: '800', letterSpacing: 2, color: theme.primary, marginVertical: 8 },
  codeActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  codeBtnOutline: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1.5, borderColor: theme.border },
  codeBtnOutlineText: { fontSize: 14, fontWeight: '600', color: theme.text },
  codeBtnPrimary: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10, backgroundColor: theme.primary },
  codeBtnPrimaryText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  warnBox: { backgroundColor: theme.warningBg, borderLeftWidth: 3, borderLeftColor: theme.warning, padding: 12, borderRadius: 8, marginVertical: 14 },
  warnText: { fontSize: 13, color: '#8a5a00', lineHeight: 19 },
  cardTitle: { fontSize: 12, fontWeight: '700', color: theme.muted, letterSpacing: 0.5, marginBottom: 10 },
  statsRow: { flexDirection: 'row' },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '800', color: theme.text },
  statLabel: { fontSize: 12, color: theme.muted, marginTop: 2 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginVertical: 10 },
  txItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  txIc: { width: 38, height: 38, borderRadius: 10, backgroundColor: theme.primaryLight, alignItems: 'center', justifyContent: 'center' },
  txTitle: { fontSize: 14, fontWeight: '600', color: theme.text },
  txDate: { fontSize: 12, color: theme.faint, marginTop: 2 },
});
