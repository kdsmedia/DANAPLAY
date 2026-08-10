import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Pressable } from 'react-native';
import { theme, statusInfo } from './utils';

export function Button({
  title, onPress, variant = 'primary', size = 'md', disabled, loading, style,
}: {
  title: string; onPress?: () => void; variant?: 'primary' | 'outline' | 'success' | 'danger' | 'ghost';
  size?: 'md' | 'lg'; disabled?: boolean; loading?: boolean; style?: any;
}) {
  const bg = {
    primary: theme.primary, outline: 'transparent', success: theme.success,
    danger: theme.danger, ghost: 'rgba(255,255,255,.15)',
  }[variant];
  const color = variant === 'outline' ? theme.text : variant === 'ghost' ? '#fff' : '#fff';
  const border = variant === 'outline' ? { borderWidth: 1.5, borderColor: theme.border } : {};
  return (
    <TouchableOpacity
      style={[styles.btn, { backgroundColor: bg }, border, size === 'lg' && styles.btnLg, disabled && styles.btnDisabled, style]}
      onPress={onPress} disabled={disabled || loading} activeOpacity={0.85}
    >
      {loading ? <ActivityIndicator color={color} /> : <Text style={[styles.btnText, { color }]}>{title}</Text>}
    </TouchableOpacity>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({ status }: { status: string }) {
  const info = statusInfo[status] || { label: status, bg: '#EEF0F6', color: '#6B7894' };
  return (
    <View style={[styles.badge, { backgroundColor: info.bg }]}>
      <Text style={[styles.badgeText, { color: info.color }]}>{info.label}</Text>
    </View>
  );
}

export function Progress({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: pct + '%' }]} />
      </View>
    </View>
  );
}

export function Toast({ message, type = 'default' }: { message: string; type?: 'default' | 'error' | 'success' }) {
  if (!message) return null;
  const bg = type === 'error' ? theme.danger : type === 'success' ? theme.success : theme.dark;
  return (
    <View style={styles.toastWrap}>
      <View style={[styles.toast, { backgroundColor: bg }]}>
        <Text style={styles.toastText}>{message}</Text>
      </View>
    </View>
  );
}

export function EmptyState({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {sub ? <Text style={styles.emptySub}>{sub}</Text> : null}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator size="large" color={theme.primary} />
      {label ? <Text style={styles.loadingLabel}>{label}</Text> : null}
    </View>
  );
}

export function ConfirmModal({
  visible, title, body, onCancel, onConfirm, confirmText = 'Konfirmasi', cancelText = 'Batal', danger,
}: {
  visible: boolean; title: string; body: React.ReactNode; onCancel: () => void;
  onConfirm: () => void; confirmText?: string; cancelText?: string; danger?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.modalBackdrop} onPress={onCancel}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{title}</Text>
          <View style={{ marginVertical: 12 }}>{typeof body === 'string' ? <Text style={styles.modalBody}>{body}</Text> : body}</View>
          <View style={styles.modalActions}>
            <Button title={cancelText} variant="outline" onPress={onCancel} style={{ flex: 1, marginRight: 8 }} />
            <Button title={confirmText} variant={danger ? 'danger' : 'primary'} onPress={onConfirm} style={{ flex: 1 }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: theme.radiusSm, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  btnLg: { paddingVertical: 16, borderRadius: theme.radius },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontSize: 15, fontWeight: '700' },
  card: { backgroundColor: theme.surface, borderRadius: theme.radius, padding: 16, marginBottom: 14, shadowColor: '#101C3C', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  progressTrack: { height: 10, backgroundColor: theme.border, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.primary, borderRadius: 99 },
  toastWrap: { position: 'absolute', bottom: 100, left: 0, right: 0, alignItems: 'center', zIndex: 100 },
  toast: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 99, maxWidth: '90%' },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 48, opacity: 0.4, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: theme.text, textAlign: 'center' },
  emptySub: { fontSize: 13, color: theme.faint, marginTop: 4, textAlign: 'center' },
  loadingWrap: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  loadingLabel: { color: theme.muted, fontSize: 12, marginTop: 10 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(11,23,38,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: theme.surface, borderRadius: theme.radiusLg, padding: 22, width: '100%', maxWidth: 380 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  modalBody: { fontSize: 13, color: theme.muted, lineHeight: 20 },
  modalActions: { flexDirection: 'row', marginTop: 8 },
});
