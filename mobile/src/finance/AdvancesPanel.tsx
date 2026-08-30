/**
 * Salary advances — the farm side.
 *
 * The decision that matters here is irreversible in the only direction that counts: **approving
 * books a `staff` expense immediately**, and there is no "unapprove" — the backend accepts
 * approve/reject only while the request is PENDING. Rejecting books nothing.
 *
 * So the confirmation names the money, and a decided request shows its outcome rather than
 * offering buttons that would answer 422 ADVANCE_NOT_PENDING.
 */
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamily, tokens } from '@/theme';
import { formatCurrency } from '@/lib/format';
import type { Advance, AdvanceStatus } from '@/types';

const STATUS_META: Record<AdvanceStatus, { label: string; color: string }> = {
  PENDING: { label: 'En attente', color: tokens.colors.warningDark },
  APPROVED: { label: 'Accordée', color: tokens.colors.successDark },
  REJECTED: { label: 'Refusée', color: tokens.colors.field.textMuted },
};

export function AdvancesPanel({
  advances,
  canDecide,
  memberName,
  onApprove,
  onReject,
}: {
  advances: Advance[];
  canDecide: boolean;
  /** Resolves a userId to a name; falls back to the id when the roster has not loaded. */
  memberName: (userId: number) => string;
  onApprove: (advance: Advance) => void;
  onReject: (advance: Advance) => void;
}) {
  if (advances.length === 0) {
    return <Text style={styles.muted}>Aucune demande d&apos;avance.</Text>;
  }

  return (
    <View style={styles.list}>
      {advances.map((a) => {
        const meta = STATUS_META[a.status];
        return (
          <View key={a.id} style={styles.card}>
            <View style={styles.top}>
              <Text style={styles.name} numberOfLines={1}>
                {memberName(a.userId)}
              </Text>
              <Text style={styles.amount}>{formatCurrency(a.amountXof)}</Text>
            </View>

            <View style={styles.bottom}>
              <Text style={styles.meta} numberOfLines={1}>
                {a.reason?.trim() ? a.reason : 'Sans motif'}
              </Text>
              <View style={[styles.chip, { borderColor: meta.color }]}>
                <Text style={[styles.chipText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            </View>

            {/* What is still to be recovered from future salaries — the number that decides
                whether granting another advance is reasonable. */}
            {a.status === 'APPROVED' && a.remainingXof > 0 ? (
              <Text style={styles.remaining}>
                Reste {formatCurrency(a.remainingXof)} à retenir sur les salaires à venir.
              </Text>
            ) : null}

            {canDecide && a.status === 'PENDING' ? (
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Refuser l'avance de ${memberName(a.userId)}`}
                  onPress={() => onReject(a)}
                  style={styles.reject}
                >
                  <Text style={styles.rejectText}>Refuser</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Accorder l'avance de ${memberName(a.userId)}`}
                  onPress={() =>
                    Alert.alert(
                      `Accorder ${formatCurrency(a.amountXof)} ?`,
                      "La dépense est enregistrée tout de suite dans votre comptabilité, et le montant sera retenu sur les prochains salaires. Une avance accordée ne peut plus être annulée.",
                      [
                        { text: 'Annuler', style: 'cancel' },
                        { text: 'Accorder', onPress: () => onApprove(a) },
                      ],
                    )
                  }
                  style={styles.approve}
                >
                  <Text style={styles.approveText}>Accorder</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: tokens.spacing[3] },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
  card: {
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    backgroundColor: tokens.colors.neutral[0],
    padding: tokens.spacing[3],
    gap: tokens.spacing[2],
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing[3] },
  name: { ...tokens.typography.bodyMd, color: tokens.colors.field.text, flex: 1 },
  amount: {
    ...tokens.typography.bodyMd,
    fontFamily: fontFamily.sansSemiBold,
    color: tokens.colors.field.text,
    fontVariant: ['tabular-nums'],
  },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing[3] },
  meta: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, flex: 1 },
  chip: {
    borderRadius: tokens.radii.full,
    borderWidth: 1,
    paddingHorizontal: tokens.spacing[2],
    paddingVertical: 2,
  },
  chipText: { ...tokens.typography.bodySm },
  remaining: { ...tokens.typography.bodySm, color: tokens.colors.warningDark, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: tokens.spacing[2], marginTop: tokens.spacing[1] },
  reject: {
    minHeight: tokens.touch.button,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
  },
  rejectText: { ...tokens.typography.button, color: tokens.colors.field.textMuted },
  approve: {
    minHeight: tokens.touch.button,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.action.commit.bg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.commit.border,
  },
  approveText: { ...tokens.typography.button, color: tokens.colors.action.commit.fg },
});
