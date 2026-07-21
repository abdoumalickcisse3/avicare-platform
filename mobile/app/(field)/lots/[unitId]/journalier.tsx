/**
 * Broiler daily entry ("Suivi journalier") — task 10, first of the four
 * field-entry screens (mortality, weighing and egg collection follow in
 * tasks 11-13, reusing the pattern established here: a local `DailyDraft`
 * accumulated via `accumulateDaily`, pushed once via `enqueueFieldMutation`).
 *
 * "Saisie" posture (design direction §3): mono-task screen, the counter
 * occupies the centre, one commit button. Mortality is the hero — it's the
 * only field with a real anatomy-of-the-counter treatment (§5): big
 * `typography.numeric` value, "effectif après saisie" consequence line,
 * `-1` (64dp, secondary, left) / `+1` (96dp, `action.accumulate`, right)
 * with a ≥24dp gap. Feed and water are lighter steppers per §2.4's step
 * table (+5kg / +5L — sacks and buckets, never the gram).
 *
 * The trap (doc 08 §10, restated in `dailyAccumulator.ts`): mortality taps
 * ADD into a running total; feed/water taps REPLACE the day's reading. Both
 * are folded through `accumulateDaily` so that distinction lives in exactly
 * one place. On "Valider", the screen pushes the current TOTAL once via
 * `enqueueFieldMutation` — never one request per tap.
 */
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { tokens } from '@/theme';
import { useListProductionUnitsQuery } from '@/store/api/productionUnitsApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { accumulateDaily, type DailyDraft } from '@/field/dailyAccumulator';
import { enqueueFieldMutation } from '@/field/enqueueMutation';

const EMPTY_DRAFT: DailyDraft = { mortalityCount: 0, feedKg: 0, waterL: 0 };

const MS_PER_DAY = 86_400_000;

/**
 * Duplicated on purpose from `lots/[unitId]/index.tsx` rather than imported:
 * route files are pages, not shared modules, and this is a two-line date
 * computation — not worth coupling two screens over.
 */
function ageInDays(startDate: string | null | undefined): number | null {
  if (!startDate) return null;
  const start = Date.parse(startDate);
  if (Number.isNaN(start)) return null;
  return Math.max(0, Math.floor((Date.now() - start) / MS_PER_DAY));
}

/**
 * Today's date as `YYYY-MM-DD`, the upsert key the backend expects — built
 * from local calendar fields, not `toISOString().slice(0, 10)`, which reads
 * the UTC date and would silently log yesterday/tomorrow for a farmer near
 * midnight in most of the world's timezones.
 */
function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function DailyEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ unitId: string }>();
  const rawUnitId = Array.isArray(params.unitId) ? params.unitId[0] : params.unitId;
  const unitId = rawUnitId ? Number(rawUnitId) : NaN;

  const selectedFarmId = useSelector(selectSelectedFarmId);

  const { data: units } = useListProductionUnitsQuery(selectedFarmId ?? skipToken);
  const unit = units?.find((u) => u.id === unitId);

  const [draft, setDraft] = useState<DailyDraft>(EMPTY_DRAFT);

  // Hooks above run unconditionally (rules of hooks); the redirect below,
  // same as the other field screens, only happens once every hook ran.
  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }

  function applyMortalityDelta(delta: number): void {
    setDraft((current) => accumulateDaily(current, { mortalityCount: delta }));
  }

  // Feed/water steppers REPLACE — the screen computes the new absolute
  // reading itself (current value + step, clamped at 0) and hands that
  // absolute figure to `accumulateDaily`, which then replaces the draft's
  // field with it. This is the "replace" half of the doc 08 §10 contract:
  // there is no additive delta to send here, only a running local reading.
  function applyFeedStep(stepKg: number): void {
    setDraft((current) => accumulateDaily(current, { feedKg: Math.max(0, current.feedKg + stepKg) }));
  }

  function applyWaterStep(stepL: number): void {
    setDraft((current) => accumulateDaily(current, { waterL: Math.max(0, current.waterL + stepL) }));
  }

  function handleValidate(): void {
    if (selectedFarmId === null || Number.isNaN(unitId)) return;

    enqueueFieldMutation({
      farmId: selectedFarmId,
      kind: 'DAILY_RECORD',
      endpoint: `/api/v1/farms/${selectedFarmId}/poultry-batches/${unitId}/daily-records`,
      payload: {
        recordDate: todayIsoDate(),
        mortalityCount: draft.mortalityCount,
        feedKg: draft.feedKg,
        waterL: draft.waterL,
      },
    });

    setDraft(EMPTY_DRAFT);
    router.back();
  }

  const age = ageInDays(unit?.startDate);
  const headerLabel = unit ? `Lot ${unit.name}${age !== null ? ` · J${age}` : ''}` : 'Lot';
  const countAfter = unit ? Math.max(0, unit.currentCount - draft.mortalityCount) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backLabel}>{`← ${headerLabel}`}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Suivi journalier</Text>
      </View>

      <View style={styles.rule} />

      <View style={styles.content}>
        {/* Mortality — the hero counter (design direction §5 anatomy). */}
        <View style={styles.counterBlock}>
          <Text style={styles.counterLabel}>MORTALITÉ DU JOUR</Text>
          <Text style={styles.counterValue}>{draft.mortalityCount}</Text>
          <Text style={styles.counterConsequence}>
            {countAfter !== null ? `Effectif après saisie : ${countAfter}` : 'Effectif indisponible hors ligne'}
          </Text>

          <View style={styles.counterControls}>
            <TouchableOpacity
              style={[styles.stepButton, styles.decrementButton, draft.mortalityCount === 0 && styles.stepButtonDisabled]}
              onPress={() => applyMortalityDelta(-1)}
              disabled={draft.mortalityCount === 0}
              accessibilityRole="button"
              accessibilityLabel="Retirer une mortalité"
            >
              <Text style={styles.decrementLabel}>−1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stepButton, styles.incrementButton]}
              onPress={() => applyMortalityDelta(1)}
              accessibilityRole="button"
              accessibilityLabel="Ajouter une mortalité"
            >
              <Text style={styles.incrementLabel}>+1</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.rule} />

        {/* Feed / water — day readings, "+5" steps per the real unit of
            manipulation (sack, bucket), not the gram/litre. */}
        <View style={styles.readingsRow}>
          <ReadingStepper
            label="ALIMENT (KG)"
            value={draft.feedKg}
            unit="kg"
            step={5}
            onIncrement={() => applyFeedStep(5)}
            onDecrement={() => applyFeedStep(-5)}
          />
          <ReadingStepper
            label="EAU (L)"
            value={draft.waterL}
            unit="L"
            step={5}
            onIncrement={() => applyWaterStep(5)}
            onDecrement={() => applyWaterStep(-5)}
          />
        </View>
      </View>

      {/* Persistent bottom action bar (design direction §2.3): the single
          commit action lives in the thumb zone, never a top-right "Save". */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.validateButton}
          onPress={handleValidate}
          accessibilityRole="button"
          accessibilityLabel="Valider la saisie du jour"
        >
          <Text style={styles.validateLabel}>Valider</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/**
 * Local, lighter-weight stepper for feed/water — same left="−"/right="+"
 * convention as the mortality counter (§2.3 thumb bias) but at
 * `touch.field` size rather than the 64/96dp mortality pair: these are
 * tapped a handful of times per day, not dozens in a row.
 */
function ReadingStepper({
  label,
  value,
  unit,
  step,
  onIncrement,
  onDecrement,
}: {
  label: string;
  value: number;
  unit: string;
  step: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <View style={styles.readingBlock}>
      <Text style={styles.readingLabel}>{label}</Text>
      <Text style={styles.readingValue}>
        {value}
        <Text style={styles.readingUnit}> {unit}</Text>
      </Text>
      <View style={styles.readingControls}>
        <TouchableOpacity
          style={[styles.readingStepButton, value === 0 && styles.stepButtonDisabled]}
          onPress={onDecrement}
          disabled={value === 0}
          accessibilityRole="button"
          accessibilityLabel={`Retirer ${step} ${unit} de ${label.toLowerCase()}`}
        >
          <Text style={styles.readingStepLabel}>−{step}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.readingStepButton, styles.readingStepButtonAccent]}
          onPress={onIncrement}
          accessibilityRole="button"
          accessibilityLabel={`Ajouter ${step} ${unit} à ${label.toLowerCase()}`}
        >
          <Text style={styles.readingStepLabelAccent}>+{step}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.field.background,
  },
  header: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[4],
    paddingBottom: tokens.spacing[4],
  },
  backLabel: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.field.textMuted,
  },
  title: {
    ...tokens.typography.displayMd,
    color: tokens.colors.field.text,
    marginTop: tokens.spacing[1],
  },
  rule: {
    height: tokens.layout.ruleWidth,
    backgroundColor: tokens.colors.field.rule,
  },
  content: {
    flex: 1,
  },
  counterBlock: {
    alignItems: 'center',
    paddingHorizontal: tokens.layout.screenPadding,
    paddingVertical: tokens.spacing[6],
  },
  counterLabel: {
    ...tokens.typography.label,
    color: tokens.colors.field.textMuted,
  },
  counterValue: {
    ...tokens.typography.numeric,
    color: tokens.colors.field.text,
    marginTop: tokens.spacing[2],
  },
  counterConsequence: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.field.textMuted,
    marginTop: tokens.spacing[2],
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing[8],
    gap: tokens.touch.gapDanger,
  },
  stepButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.full,
    borderWidth: tokens.layout.borderWidth,
  },
  stepButtonDisabled: {
    opacity: 0.4,
  },
  decrementButton: {
    width: tokens.touch.counterSecondary,
    height: tokens.touch.counterSecondary,
    backgroundColor: tokens.colors.action.secondary.bg,
    borderColor: tokens.colors.action.secondary.border,
  },
  decrementLabel: {
    ...tokens.typography.headingMd,
    color: tokens.colors.action.secondary.fg,
  },
  incrementButton: {
    width: tokens.touch.counterPrimary,
    height: tokens.touch.counterPrimary,
    backgroundColor: tokens.colors.action.accumulate.bg,
    borderColor: tokens.colors.action.accumulate.border,
  },
  incrementLabel: {
    ...tokens.typography.headingLg,
    color: tokens.colors.action.accumulate.fg,
  },
  readingsRow: {
    flexDirection: 'row',
    paddingHorizontal: tokens.layout.screenPadding,
    gap: tokens.spacing[6],
  },
  readingBlock: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: tokens.spacing[4],
  },
  readingLabel: {
    ...tokens.typography.label,
    color: tokens.colors.field.textMuted,
  },
  readingValue: {
    ...tokens.typography.numericSm,
    color: tokens.colors.field.text,
    marginTop: tokens.spacing[2],
  },
  readingUnit: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.field.textMuted,
  },
  readingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: tokens.spacing[3],
    gap: tokens.spacing[3],
  },
  readingStepButton: {
    minWidth: tokens.touch.field,
    minHeight: tokens.touch.field,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.md,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.secondary.border,
    backgroundColor: tokens.colors.action.secondary.bg,
    paddingHorizontal: tokens.spacing[3],
  },
  readingStepButtonAccent: {
    backgroundColor: tokens.colors.action.accumulate.bg,
    borderColor: tokens.colors.action.accumulate.border,
  },
  readingStepLabel: {
    ...tokens.typography.button,
    color: tokens.colors.action.secondary.fg,
  },
  readingStepLabelAccent: {
    ...tokens.typography.button,
    color: tokens.colors.action.accumulate.fg,
  },
  actionBar: {
    minHeight: tokens.layout.actionBarHeight,
    paddingHorizontal: tokens.layout.screenPadding,
    paddingVertical: tokens.spacing[4],
    justifyContent: 'center',
    borderTopWidth: tokens.layout.ruleWidth,
    borderTopColor: tokens.colors.field.rule,
  },
  validateButton: {
    minHeight: tokens.touch.field,
    borderRadius: tokens.radii.md,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.commit.border,
    backgroundColor: tokens.colors.action.commit.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validateLabel: {
    ...tokens.typography.button,
    color: tokens.colors.action.commit.fg,
  },
});
