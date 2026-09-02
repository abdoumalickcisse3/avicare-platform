/**
 * The frozen end-of-cycle report of a closed batch — mirrors the web
 * `BatchClosureTab`, in the field card idiom.
 *
 * The valuation warning is the point of the screen: when a consumed article
 * carried no price it weighs zero in the total, so the report says the real
 * cost is higher. A silent understatement would always flatter, and a farmer
 * who knows his cost of production would stop trusting the rest.
 */
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { RotateCcw } from 'lucide-react-native';
import { tokens } from '@/theme';
import { formatCurrency, formatNumber } from '@/lib/format';
import {
  useGetUnitClosureQuery,
  useReopenUnitMutation,
  type UnitClosure,
} from '@/store/api/closureApi';

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={[styles.lineValue, strong && styles.lineValueStrong]}>{value}</Text>
    </View>
  );
}

const orDash = (v: number | null, render: (n: number) => string) =>
  v === null || v === undefined ? '—' : render(v);

export function BatchClosureCard({
  farmId,
  unitId,
  canReopen,
}: {
  farmId: number;
  unitId: number;
  canReopen: boolean;
}) {
  const { data: closure, isLoading, error } = useGetUnitClosureQuery({ farmId, unitId });
  const [reopenUnit, { isLoading: isReopening }] = useReopenUnitMutation();
  const [busy, setBusy] = useState(false);

  if (isLoading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={tokens.colors.primary[600]} />
      </View>
    );
  }

  if (error || !closure) {
    return (
      <View style={styles.card}>
        <Text style={styles.muted}>Aucun bilan pour cette bande.</Text>
      </View>
    );
  }

  const c: UnitClosure = closure;
  const unpriced = c.consumedArticles - c.valuedArticles;

  function confirmReopen(): void {
    Alert.alert(
      'Rouvrir la bande ?',
      'Le bilan de cette bande sera supprimé. La bande redeviendra active et pourra à nouveau recevoir des saisies.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Rouvrir',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await reopenUnit({ farmId, unitId }).unwrap();
            } catch {
              Alert.alert('Réouverture', "La bande n'a pas pu être rouverte. Réessayez.");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.wrap}>
      {c.valuationIncomplete && (
        <View style={styles.warn}>
          <Text style={styles.warnText}>
            {unpriced === 1
              ? "1 article consommé n'a pas de prix"
              : `${unpriced} articles consommés n'ont pas de prix`}{' '}
            ({c.valuedArticles}/{c.consumedArticles} valorisés). Le coût réel est plus élevé que
            celui affiché.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Technique</Text>
        <Line label="Durée" value={`${c.durationDays} jours`} />
        <Line label="Effectif initial" value={formatNumber(c.initialCount)} />
        <Line label="Morts" value={formatNumber(c.deaths)} />
        <Line label="Taux de mortalité" value={orDash(c.mortalityPercent, (n) => `${n} %`)} />
        <Line label="Sujets restants" value={formatNumber(c.remainingCount)} />
        <Line
          label="Poids de sortie"
          value={orDash(c.exitWeightG, (n) => `${formatNumber(n)} g`)}
        />
        <Line label="GMQ" value={orDash(c.avgDailyGainG, (n) => `${n} g/j`)} />
        <Line
          label="Aliment consommé"
          value={orDash(c.totalFeedKg, (n) => `${formatNumber(n)} kg`)}
        />
        <Line
          label="Indice de consommation"
          value={orDash(c.feedConversionRatio, (n) => String(n))}
          strong
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Argent</Text>
        <Line label="Recettes" value={formatCurrency(c.revenueXof)} />
        <Line label="Aliment et produits" value={formatCurrency(c.feedCostXof)} />
        <Line label="Poussins" value={formatCurrency(c.chickCostXof)} />
        <Line label="Autres dépenses" value={formatCurrency(c.otherExpenseXof)} />
        <Line label="Coût total" value={formatCurrency(c.totalCostXof)} strong />
        <View style={styles.marginRow}>
          <Text style={styles.lineLabel}>Marge</Text>
          <Text
            style={[
              styles.marginValue,
              { color: c.marginXof >= 0 ? tokens.colors.success : tokens.colors.error },
            ]}
          >
            {formatCurrency(c.marginXof)}
          </Text>
        </View>
        <Line
          label="Coût de revient au kg vif"
          value={orDash(c.costPerKgXof, (n) => formatCurrency(n))}
          strong
        />
      </View>

      {!!c.notes && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Note</Text>
          <Text style={styles.noteText}>{c.notes}</Text>
        </View>
      )}

      <Text style={styles.frozen}>Bilan figé. Les chiffres ne bougeront plus.</Text>

      {canReopen && (
        <Pressable
          style={({ pressed }) => [styles.reopenBtn, pressed && { opacity: 0.85 }]}
          onPress={confirmReopen}
          disabled={busy || isReopening}
          accessibilityRole="button"
          accessibilityLabel="Rouvrir la bande"
        >
          <RotateCcw size={18} color={tokens.colors.field.textMuted} />
          <Text style={styles.reopenText}>Rouvrir la bande</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.spacing[4] },
  card: {
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    padding: tokens.spacing[4],
    gap: tokens.spacing[2],
  },
  cardTitle: {
    ...tokens.typography.label,
    color: tokens.colors.field.textMuted,
    marginBottom: tokens.spacing[1],
  },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: tokens.spacing[3] },
  lineLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, flexShrink: 1 },
  lineValue: { ...tokens.typography.bodySm, color: tokens.colors.field.text, fontVariant: ['tabular-nums'] },
  lineValueStrong: { fontWeight: '700' },
  marginRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: tokens.spacing[3],
    marginTop: tokens.spacing[1],
  },
  marginValue: { ...tokens.typography.headingMd, fontVariant: ['tabular-nums'] },
  noteText: { ...tokens.typography.bodySm, color: tokens.colors.field.text },
  muted: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  warn: {
    backgroundColor: tokens.colors.warningLight,
    borderWidth: 1,
    borderColor: tokens.colors.warning,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing[4],
  },
  warnText: { ...tokens.typography.bodySm, color: tokens.colors.warningDark, lineHeight: 20 },
  frozen: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, textAlign: 'center' },
  reopenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[2],
    minHeight: tokens.touch.cta,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[0],
  },
  reopenText: { ...tokens.typography.button, color: tokens.colors.field.textMuted },
});
