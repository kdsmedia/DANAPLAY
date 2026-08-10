import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, DimensionValue } from 'react-native';
import { theme } from './utils';
import { Button, Toast } from './components';
import { API } from './api';
import { useAuth } from './auth';

type AdSession = {
  ad: { id: string; title: string; description: string; advertiser: string; duration_seconds: number; reward_points: number };
  viewToken: string;
  startedAt: string;
  expiresAt: string;
  minWatchSeconds: number;
};

/**
 * Ad viewer modal. Simulates watching an ad with a server-enforced countdown.
 * The reward is NEVER granted client-side: the client only calls /complete after
 * the local countdown reaches 0. The server independently validates elapsed time
 * (started_at -> now >= minWatchSeconds) so skipping early yields no reward.
 */
export function AdViewer({ visible, onClose, onRewarded }: {
  visible: boolean;
  onClose: () => void;
  onRewarded?: (reward: number, balance: number) => void;
}) {
  const { refreshBalance } = useAuth();
  const [session, setSession] = useState<AdSession | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type?: 'default' | 'error' | 'success' }>({ msg: '' });
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  };

  const startAd = async () => {
    setLoading(true);
    setToast({ msg: '' });
    try {
      const s: AdSession = await API.ads.start();
      setSession(s);
      setRemaining(s.minWatchSeconds);
      stopTimer();
      tickRef.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) { stopTimer(); return 0; }
          return r - 1;
        });
      }, 1000);
    } catch (e: any) {
      const msg = e?.body?.error || e?.message || 'Gagal memulai iklan';
      setToast({ msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) startAd();
    else { setSession(null); setRemaining(0); stopTimer(); }
    return stopTimer;
  }, [visible]);

  const complete = async () => {
    if (!session || remaining > 0 || completing) return;
    setCompleting(true);
    setToast({ msg: '' });
    try {
      const d: any = await API.ads.complete(session.viewToken);
      await refreshBalance();
      setToast({ msg: `🎉 +${d.rewardGranted.toLocaleString('id-ID')} poin!`, type: 'success' });
      onRewarded?.(d.rewardGranted, d.balanceAfter ?? 0);
      setTimeout(() => { reset(); }, 1200);
    } catch (e: any) {
      const msg = e?.body?.error || e?.message || 'Gagal menyelesaikan iklan';
      setToast({ msg, type: 'error' });
    } finally {
      setCompleting(false);
    }
  };

  const reset = () => {
    stopTimer();
    setSession(null);
    setRemaining(0);
    setToast({ msg: '' });
  };

  const close = () => { stopTimer(); setSession(null); setRemaining(0); setToast({ msg: '' }); onClose(); };

  const pct = session ? Math.round(((session.minWatchSeconds - remaining) / session.minWatchSeconds) * 100) : 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>📺 Tonton Iklan</Text>
            <TouchableOpacity onPress={close} disabled={loading || completing}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /><Text style={styles.muted}>Memuat iklan...</Text></View>
          ) : session ? (
            <View>
              <View style={styles.adBox}>
                <Text style={styles.adBadge}>IKLAN</Text>
                <Text style={styles.adTitle}>{session.ad.title}</Text>
                <Text style={styles.adDesc}>{session.ad.description}</Text>
                <Text style={styles.advertiser}>{session.ad.advertiser}</Text>
              </View>

              <View style={styles.rewardRow}>
                <Text style={styles.rewardLabel}>Reward</Text>
                <Text style={styles.rewardVal}>⭐ {session.ad.reward_points.toLocaleString('id-ID')} poin</Text>
              </View>

              <View style={styles.countdownWrap}>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: (pct + '%') as DimensionValue }]} />
                </View>
                <Text style={styles.countdownText}>
                  {remaining > 0 ? `Tonton penuh: ${remaining}s` : '✓ Selesai ditonton'}
                </Text>
              </View>

              <Text style={styles.warn}>⚠️ Reward hanya diberikan jika iklan ditonton penuh tanpa skip.</Text>

              <Button
                title={remaining > 0 ? `Tunggu ${remaining}s` : (completing ? 'Memproses...' : 'KLAIM REWARD')}
                onPress={complete}
                disabled={remaining > 0 || completing}
                loading={completing}
                variant="success"
                style={{ marginTop: 12 }}
              />
            </View>
          ) : (
            <View style={styles.center}><Text style={styles.muted}>Tidak ada iklan tersedia.</Text></View>
          )}

          <Toast message={toast.msg} type={toast.type} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', color: theme.text },
  closeBtn: { fontSize: 20, color: theme.muted, padding: 4 },
  center: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  muted: { color: theme.muted, fontSize: 13 },
  adBox: { backgroundColor: theme.primaryLight, borderRadius: 16, padding: 20, alignItems: 'center' },
  adBadge: { fontSize: 10, fontWeight: '700', color: theme.primary, letterSpacing: 1, backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  adTitle: { fontSize: 18, fontWeight: '700', color: theme.text, marginTop: 10 },
  adDesc: { fontSize: 13, color: theme.muted, marginTop: 4, textAlign: 'center' },
  advertiser: { fontSize: 11, color: theme.faint, marginTop: 6 },
  rewardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingHorizontal: 4 },
  rewardLabel: { fontSize: 13, color: theme.muted },
  rewardVal: { fontSize: 15, fontWeight: '700', color: theme.success },
  countdownWrap: { marginTop: 14 },
  track: { height: 8, backgroundColor: theme.border, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: theme.primary, borderRadius: 4 },
  countdownText: { fontSize: 12, color: theme.muted, marginTop: 8, textAlign: 'center' },
  warn: { fontSize: 11, color: theme.warning, marginTop: 10, textAlign: 'center' },
});
