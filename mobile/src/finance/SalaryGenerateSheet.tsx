/**
 * Generate one month's salary lines.
 *
 * The backend rule that shapes this: generation is **all-or-nothing per period**. If a single
 * member already has a line for the month, it answers 409 SALARY_PERIOD_EXISTS and creates
 * nothing at all — so it cannot be re-run to top up a period after hiring someone mid-month.
 * The sheet says so before the button, rather than letting a 409 explain it afterwards.
 *
 * It also shows what will be generated: the active salary settings, and the advances that will
 * be deducted. A salary run is the largest single write in the app, and it should not be a
 * surprise.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fontFamily, tokens } from '@/theme';
import { FormField } from '@/components/field/FormField';
import { formatCurrency } from '@/lib/format';
import type { SalarySetting } from '@/types';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Previous month in `YYYY-MM` — salaries are run once the month is over. */
export function lastMonth(today: Date = new Date()): string {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function SalaryGenerateSheet({
  open,
  settings,
  saving,
  memberName,
  onClose,
  onSubmit,
}: {
  open: boolean;
  settings: SalarySetting[];
  saving: boolean;
  memberName: (userId: number) => string;
  onClose: () => void;
  onSubmit: (period: string) => void;
}) {
  const [period, setPeriod] = useState(lastMonth());

  useEffect(() => {
    if (open) setPeriod(lastMonth());
  }, [open]);

  const active = settings.filter((s) => s.active);
  const total = active.reduce((sum, s) => sum + s.monthlySalaryXof, 0);
  const validPeriod = PERIOD.test(period.trim());
  const canSubmit = validPeriod && active.length > 0 && !saving;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Fermer" onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Générer les salaires</Text>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <FormField
            label="Mois"
            required
            value={period}
            onChangeText={setPeriod}
            placeholder="2026-07"
            maxLength={7}
            error={period.length > 0 && !validPeriod ? 'Format attendu : AAAA-MM' : undefined}
            helperText="Le mois écoulé, pas le mois en cours."
          />

          {active.length === 0 ? (
            <Text style={styles.warn}>
              Aucun salaire mensuel n&apos;est configuré. Renseignez d&apos;abord le salaire de
              chaque membre.
            </Text>
          ) : (
            <>
              <Text style={styles.label}>Seront générés</Text>
              {active.map((s) => (
                <View key={s.id} style={styles.row}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {memberName(s.userId)}
                  </Text>
                  <Text style={styles.rowAmount}>{formatCurrency(s.monthlySalaryXof)}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total brut</Text>
                <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
              </View>
              <Text style={styles.note}>
                Les avances accordées et non encore retenues seront déduites de chaque salaire.
              </Text>
            </>
          )}

          <View style={styles.warnBox}>
            <Text style={styles.warnText}>
              La génération se fait en une fois pour tout le monde. Si un salaire existe déjà
              pour ce mois, rien n&apos;est généré — impossible d&apos;ajouter quelqu&apos;un à un
              mois déjà traité.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Annuler"
            style={styles.cancel}
          >
            <Text style={styles.cancelText}>Annuler</Text>
          </Pressable>
          <Pressable
            onPress={() => canSubmit && onSubmit(period.trim())}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="Générer les salaires"
            style={[styles.save, !canSubmit && styles.disabled]}
          >
            <Text style={styles.saveText}>{saving ? 'Génération…' : 'Générer'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28, 25, 23, 0.45)' },
  sheet: {
    backgroundColor: tokens.colors.field.background,
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    paddingTop: tokens.spacing[5],
    maxHeight: '90%',
  },
  title: {
    ...tokens.typography.headingLg,
    color: tokens.colors.field.text,
    paddingHorizontal: tokens.layout.screenPadding,
    marginBottom: tokens.spacing[2],
  },
  content: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingBottom: tokens.spacing[4],
    gap: tokens.spacing[3],
  },
  label: { ...tokens.typography.label, color: tokens.colors.field.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing[3] },
  rowName: { ...tokens.typography.bodyMd, color: tokens.colors.field.text, flex: 1 },
  rowAmount: { ...tokens.typography.bodyMd, color: tokens.colors.field.text, fontVariant: ['tabular-nums'] },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: tokens.colors.field.ruleSubtle,
    paddingTop: tokens.spacing[2],
  },
  totalLabel: { ...tokens.typography.label, color: tokens.colors.field.textMuted },
  totalValue: {
    ...tokens.typography.bodyMd,
    fontFamily: fontFamily.sansSemiBold,
    color: tokens.colors.field.text,
  },
  note: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, lineHeight: 18 },
  warn: { ...tokens.typography.bodySm, color: tokens.colors.warningDark, lineHeight: 19 },
  warnBox: { borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.warningLight, padding: tokens.spacing[3] },
  warnText: { ...tokens.typography.bodySm, color: tokens.colors.warningDark, lineHeight: 19 },
  actions: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[3],
    paddingBottom: tokens.spacing[6],
    borderTopWidth: 1,
    borderTopColor: tokens.colors.field.ruleSubtle,
  },
  cancel: {
    minHeight: tokens.touch.primaryButton,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[6],
  },
  cancelText: { ...tokens.typography.button, color: tokens.colors.field.textMuted },
  save: {
    flex: 1,
    minHeight: tokens.touch.primaryButton,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.action.commit.bg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.commit.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  saveText: { ...tokens.typography.button, color: tokens.colors.action.commit.fg },
});
