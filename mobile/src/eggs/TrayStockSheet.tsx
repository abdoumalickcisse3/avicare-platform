/**
 * Correct the tray stock — the keypad's second use.
 *
 * Two endpoints exist for this and picking the wrong one loses counts. `PUT /tray-stock` writes
 * an absolute pair; `POST /tray-stock/adjust` writes deltas. If two people correct the store
 * within a minute of each other, absolute writes overwrite one another and the later one wins
 * outright, while deltas compose and both are kept.
 *
 * A delta is also what a farmer actually knows after a round: "twelve more full trays", not "one
 * hundred and forty-seven full trays". So the sheet is built on deltas, and the absolute write is
 * offered separately, as the deliberate act it is — a physical recount.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamily, tokens } from '@/theme';
import { NumericKeypad } from '@/components/field/NumericKeypad';
import { formatNumber } from '@/lib/format';

type Kind = 'full' | 'empty';
type Mode = 'adjust' | 'recount';

export function TrayStockSheet({
  open,
  fullTraysCount,
  emptyTraysCount,
  saving,
  onClose,
  onAdjust,
  onRecount,
}: {
  open: boolean;
  fullTraysCount: number;
  emptyTraysCount: number;
  saving: boolean;
  onClose: () => void;
  onAdjust: (body: { fullDelta: number; emptyDelta: number }) => void;
  onRecount: (body: { fullTraysCount: number; emptyTraysCount: number }) => void;
}) {
  const [mode, setMode] = useState<Mode>('adjust');
  const [kind, setKind] = useState<Kind>('full');
  const [sign, setSign] = useState<1 | -1>(1);
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!open) return;
    setMode('adjust');
    setKind('full');
    setSign(1);
    setValue('');
  }, [open]);

  const n = Number(value || '0');
  const valid = Number.isFinite(n) && n > 0;

  const current = kind === 'full' ? fullTraysCount : emptyTraysCount;
  const projected = mode === 'adjust' ? current + sign * n : n;

  const submit = () => {
    if (mode === 'adjust' && !valid) return;
    if (mode === 'adjust') {
      const delta = sign * n;
      onAdjust({
        fullDelta: kind === 'full' ? delta : 0,
        emptyDelta: kind === 'empty' ? delta : 0,
      });
    } else {
      onRecount({
        fullTraysCount: kind === 'full' ? n : fullTraysCount,
        emptyTraysCount: kind === 'empty' ? n : emptyTraysCount,
      });
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Fermer" onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Plateaux</Text>

        <View style={styles.row}>
          {(['full', 'empty'] as const).map((k) => (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityState={{ selected: kind === k }}
              accessibilityLabel={k === 'full' ? 'Plateaux pleins' : 'Plateaux vides'}
              onPress={() => setKind(k)}
              style={[styles.tab, kind === k && styles.tabOn]}
            >
              <Text style={[styles.tabText, kind === k && styles.tabTextOn]}>
                {k === 'full' ? 'Pleins' : 'Vides'}
              </Text>
              <Text style={styles.tabCount}>
                {formatNumber(k === 'full' ? fullTraysCount : emptyTraysCount)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          {(['adjust', 'recount'] as const).map((m) => (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === m }}
              accessibilityLabel={m === 'adjust' ? 'Ajouter ou retirer' : 'Recompter'}
              onPress={() => {
                setMode(m);
                setValue('');
              }}
              style={[styles.mode, mode === m && styles.modeOn]}
            >
              <Text style={[styles.modeText, mode === m && styles.modeTextOn]}>
                {m === 'adjust' ? 'Ajouter / retirer' : 'Recompter'}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'adjust' ? (
          <View style={styles.row}>
            {([1, -1] as const).map((s) => (
              <Pressable
                key={s}
                accessibilityRole="button"
                accessibilityState={{ selected: sign === s }}
                accessibilityLabel={s === 1 ? 'Ajouter' : 'Retirer'}
                onPress={() => setSign(s)}
                style={[styles.sign, sign === s && (s === 1 ? styles.signPlus : styles.signMinus)]}
              >
                <Text style={[styles.signText, sign === s && styles.signTextOn]}>
                  {s === 1 ? '+ Ajouter' : '− Retirer'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.hint}>
            Le compte saisi remplace celui de l&apos;application. À réserver à un vrai comptage
            physique : une correction relative se combine mieux si quelqu&apos;un d&apos;autre
            compte en même temps.
          </Text>
        )}

        <View style={styles.readout}>
          <Text style={styles.value} accessibilityLabel="Valeur saisie">
            {value || '0'}
          </Text>
          <Text style={styles.projected}>
            {kind === 'full' ? 'Pleins' : 'Vides'} après : {formatNumber(Math.max(0, projected))}
          </Text>
          {mode === 'adjust' && sign === -1 && n > current ? (
            <Text style={styles.warn}>
              Vous retirez plus que le stock connu ({formatNumber(current)}).
            </Text>
          ) : null}
        </View>

        <NumericKeypad value={value} onChange={setValue} maxLength={6} />

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
            onPress={submit}
            disabled={(mode === 'adjust' && !valid) || saving}
            accessibilityRole="button"
            accessibilityLabel="Enregistrer les plateaux"
            style={[styles.save, ((mode === 'adjust' && !valid) || saving) && styles.disabled]}
          >
            <Text style={styles.saveText}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Text>
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
    paddingBottom: tokens.spacing[6],
    gap: tokens.spacing[3],
  },
  title: {
    ...tokens.typography.headingLg,
    color: tokens.colors.field.text,
    paddingHorizontal: tokens.layout.screenPadding,
  },
  row: {
    flexDirection: 'row',
    gap: tokens.spacing[2],
    paddingHorizontal: tokens.layout.screenPadding,
  },
  tab: {
    flex: 1,
    minHeight: tokens.touch.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    backgroundColor: tokens.colors.neutral[0],
    paddingVertical: tokens.spacing[2],
  },
  tabOn: { borderColor: tokens.colors.primary[600], backgroundColor: tokens.colors.primary[50] },
  tabText: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  tabTextOn: { fontFamily: fontFamily.sansSemiBold, color: tokens.colors.primary[700] },
  tabCount: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  mode: {
    flex: 1,
    minHeight: tokens.touch.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.full,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
  },
  modeOn: { backgroundColor: tokens.colors.field.text, borderColor: tokens.colors.field.text },
  modeText: { ...tokens.typography.bodySm, color: tokens.colors.field.text },
  modeTextOn: { color: tokens.colors.neutral[0], fontFamily: fontFamily.sansSemiBold },
  sign: {
    flex: 1,
    minHeight: tokens.touch.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
  },
  signPlus: {
    backgroundColor: tokens.colors.action.accumulate.bg,
    borderColor: tokens.colors.action.accumulate.border,
  },
  signMinus: { backgroundColor: tokens.colors.errorDark, borderColor: tokens.colors.errorDark },
  signText: { ...tokens.typography.button, color: tokens.colors.field.text },
  signTextOn: { color: tokens.colors.neutral[0] },
  hint: {
    ...tokens.typography.bodySm,
    color: tokens.colors.field.textMuted,
    lineHeight: 18,
    paddingHorizontal: tokens.layout.screenPadding,
  },
  readout: { paddingHorizontal: tokens.layout.screenPadding, gap: 2 },
  value: { ...tokens.typography.numeric, color: tokens.colors.field.text },
  projected: { ...tokens.typography.bodyMd, color: tokens.colors.primary[700] },
  warn: { ...tokens.typography.bodySm, color: tokens.colors.warningDark },
  actions: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[2],
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
