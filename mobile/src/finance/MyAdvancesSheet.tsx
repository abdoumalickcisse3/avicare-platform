/**
 * Mes avances — the self-service side of a salary advance, mobile port of the web
 * `MyAdvancesDialog`.
 *
 * The person who most needs this is the field worker, and they usually have nothing but the
 * phone: `useRequestAdvanceMutation` was exported and called from nowhere, so asking for an
 * advance was a web-only act. It lives in the Menu tab's account card rather than under
 * Réglages, because Réglages is gated by `settings:read` — which a FARMER does not have.
 *
 * Anyone may ask; only OWNER / MANAGER decide (that side is the Finance tab's AdvancesPanel).
 */
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { fontFamily, tokens } from '@/theme';
import { useGetMyAdvancesQuery, useRequestAdvanceMutation } from '@/store/api/financeApi';
import { formatCurrency, formatRelative } from '@/lib/format';
import type { AdvanceStatus } from '@/types';

const STATUS_META: Record<AdvanceStatus, { label: string; color: string }> = {
  PENDING: { label: 'En attente', color: tokens.colors.warningDark },
  APPROVED: { label: 'Accordée', color: tokens.colors.successDark },
  REJECTED: { label: 'Refusée', color: tokens.colors.field.textMuted },
};

export function MyAdvancesSheet({
  farmId,
  open,
  onClose,
}: {
  farmId: number;
  open: boolean;
  onClose: () => void;
}) {
  const { data: advances = [], isLoading } = useGetMyAdvancesQuery(open ? { farmId } : skipToken);
  const [requestAdvance, { isLoading: submitting }] = useRequestAdvanceMutation();

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setAmount('');
      setReason('');
    }
  }, [open]);

  const amountNum = /^\d+$/.test(amount.trim()) ? Number(amount.trim()) : NaN;
  const canSubmit = Number.isInteger(amountNum) && amountNum > 0 && !submitting;

  // What is still to be deducted from future salaries — the number that says whether asking
  // for another one is reasonable.
  const stillOwed = advances
    .filter((a) => a.status === 'APPROVED')
    .reduce((sum, a) => sum + a.remainingXof, 0);

  const submit = async () => {
    if (!canSubmit) return;
    try {
      await requestAdvance({
        body: { farmId, amountXof: amountNum, reason: reason.trim() || undefined },
      }).unwrap();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAmount('');
      setReason('');
    } catch {
      Alert.alert('Avance', "La demande n'a pas pu être envoyée. Réessayez.");
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Fermer" onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Mes avances</Text>
        <Text style={styles.subtitle}>
          Une avance accordée est retenue sur vos prochains salaires.
        </Text>

        <Text style={styles.fieldLabel}>Montant (XOF)</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="0"
          placeholderTextColor={tokens.colors.field.disabled}
          accessibilityLabel="Montant de l'avance"
          style={styles.input}
        />

        <Text style={styles.fieldLabel}>Motif (facultatif)</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Ex. Rentrée scolaire"
          placeholderTextColor={tokens.colors.field.disabled}
          accessibilityLabel="Motif de l'avance"
          style={styles.input}
          maxLength={200}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Demander l'avance"
          onPress={submit}
          disabled={!canSubmit}
          style={[styles.commit, !canSubmit && styles.commitDisabled]}
        >
          <Text style={styles.commitLabel}>{submitting ? 'Envoi…' : 'Demander'}</Text>
        </Pressable>

        {stillOwed > 0 && (
          <Text style={styles.owed}>
            {formatCurrency(stillOwed)} restent à retenir sur vos prochains salaires.
          </Text>
        )}

        <Text style={styles.historyTitle}>Historique</Text>
        {isLoading ? (
          <Text style={styles.muted}>Chargement…</Text>
        ) : advances.length === 0 ? (
          <Text style={styles.muted}>Aucune demande d&apos;avance.</Text>
        ) : (
          <ScrollView style={styles.historyScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.historyList}>
              {advances.map((a) => {
                const meta = STATUS_META[a.status];
                return (
                  <View key={a.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowAmount}>{formatCurrency(a.amountXof)}</Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {formatRelative(a.requestedAt)}
                        {a.reason?.trim() ? ` · ${a.reason}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.chip, { borderColor: meta.color }]}>
                      <Text style={[styles.chipText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(18,43,18,0.35)' },
  sheet: {
    backgroundColor: tokens.colors.neutral[0],
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    padding: tokens.layout.screenPadding,
    paddingBottom: tokens.spacing[8],
    gap: tokens.spacing[1],
  },
  title: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginBottom: tokens.spacing[1] },
  fieldLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[2] },
  input: {
    minHeight: 46,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[300],
    paddingHorizontal: tokens.spacing[3],
    color: tokens.colors.field.text,
    ...tokens.typography.bodyMd,
  },
  commit: {
    minHeight: tokens.touch.primaryButton,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.accent[400],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing[4],
  },
  commitDisabled: { opacity: 0.4 },
  commitLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.primary[900] },
  owed: { ...tokens.typography.bodySm, color: tokens.colors.warningDark, marginTop: tokens.spacing[3] },
  historyTitle: {
    ...tokens.typography.headingMd,
    fontSize: 15,
    color: tokens.colors.field.text,
    marginTop: tokens.spacing[5],
  },
  muted: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[2] },
  historyScroll: { maxHeight: 220, marginTop: tokens.spacing[2] },
  historyList: { gap: tokens.spacing[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[3],
  },
  rowAmount: {
    ...tokens.typography.bodyMd,
    fontFamily: fontFamily.sansSemiBold,
    color: tokens.colors.field.text,
    fontVariant: ['tabular-nums'],
  },
  rowMeta: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },
  chip: {
    borderRadius: tokens.radii.full,
    borderWidth: 1,
    paddingHorizontal: tokens.spacing[2],
    paddingVertical: 2,
  },
  chipText: { ...tokens.typography.bodySm },
});
