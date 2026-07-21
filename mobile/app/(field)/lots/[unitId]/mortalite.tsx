/**
 * Layer mortality entry ("Mortalité") — task 11, reusing the layout and
 * counter anatomy established by task 10's `journalier.tsx`.
 *
 * The key difference from journalier's mortality stepper is the clientRef
 * semantics (doc 08 §9 / Task 2's backend dedup): journalier accumulates
 * taps locally and pushes a single UPSERT per day, so one clientRef per
 * screen visit is enough. This screen is the opposite — every "Enregistrer"
 * is its OWN distinct attrition event (a farmer can log a batch found dead
 * in the morning, then another in the evening; both must persist). Each
 * submission therefore mints a FRESH clientRef, put in the request payload
 * AND handed to `enqueueFieldMutation` verbatim — same value in both
 * places, so the server's replay dedup on `client_ref` (in the body)
 * actually protects this exact event and never merges it with a
 * neighbouring one.
 */
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import * as Crypto from 'expo-crypto';
import { tokens } from '@/theme';
import { useListProductionUnitsQuery } from '@/store/api/productionUnitsApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { enqueueFieldMutation } from '@/field/enqueueMutation';

const MS_PER_DAY = 86_400_000;

/** Duplicated on purpose — see journalier.tsx's identical helper for why. */
function ageInDays(startDate: string | null | undefined): number | null {
  if (!startDate) return null;
  const start = Date.parse(startDate);
  if (Number.isNaN(start)) return null;
  return Math.max(0, Math.floor((Date.now() - start) / MS_PER_DAY));
}

export default function MortalityEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ unitId: string }>();
  const rawUnitId = Array.isArray(params.unitId) ? params.unitId[0] : params.unitId;
  const unitId = rawUnitId ? Number(rawUnitId) : NaN;

  const selectedFarmId = useSelector(selectSelectedFarmId);

  const { data: units } = useListProductionUnitsQuery(selectedFarmId ?? skipToken);
  const unit = units?.find((u) => u.id === unitId);

  const [count, setCount] = useState(0);
  const [reason, setReason] = useState('');

  // Hooks above run unconditionally (rules of hooks); the redirect below
  // only happens once every hook ran, same as the other field screens.
  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }

  function handleSubmit(): void {
    // Backend requires a strictly positive count (@Positive) — a zero-count
    // "Enregistrer" is a no-op rather than a rejected request.
    if (selectedFarmId === null || Number.isNaN(unitId) || count < 1) return;

    const ref = Crypto.randomUUID();
    enqueueFieldMutation({
      farmId: selectedFarmId,
      kind: 'MORTALITY',
      endpoint: `/api/v1/farms/${selectedFarmId}/production-units/${unitId}/mortality`,
      payload: { count, reason: reason.trim() || undefined, clientRef: ref },
      clientRef: ref,
    });

    setCount(0);
    setReason('');
    router.back();
  }

  const age = ageInDays(unit?.startDate);
  const headerLabel = unit ? `Lot ${unit.name}${age !== null ? ` · J${age}` : ''}` : 'Lot';
  const countAfter = unit ? Math.max(0, unit.currentCount - count) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={{
            top: tokens.spacing[2],
            bottom: tokens.spacing[2],
            left: tokens.spacing[2],
            right: tokens.spacing[2],
          }}
        >
          <Text style={styles.backLabel}>{`← ${headerLabel}`}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mortalité</Text>
      </View>

      <View style={styles.rule} />

      <View style={styles.content}>
        {/* Hero counter — anatomy of the counter (design direction §5). */}
        <View style={styles.counterBlock}>
          <Text style={styles.counterLabel}>MORTALITÉ DU JOUR</Text>
          <Text style={styles.counterValue}>{count}</Text>
          <Text style={styles.counterConsequence}>
            {countAfter !== null ? `Effectif après saisie : ${countAfter}` : 'Effectif indisponible hors ligne'}
          </Text>

          <View style={styles.counterControls}>
            <TouchableOpacity
              style={[styles.stepButton, styles.decrementButton, count === 0 && styles.stepButtonDisabled]}
              onPress={() => setCount((c) => Math.max(0, c - 1))}
              disabled={count === 0}
              accessibilityRole="button"
              accessibilityLabel="Retirer une mortalité"
            >
              <Text style={styles.decrementLabel}>−1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stepButton, styles.incrementButton]}
              onPress={() => setCount((c) => c + 1)}
              accessibilityRole="button"
              accessibilityLabel="Ajouter une mortalité"
            >
              <Text style={styles.incrementLabel}>+1</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.rule} />

        {/* Optional free-text reason — never autofocused (design direction
            §2.4: a keyboard must never surge over the thumb zone on mount). */}
        <View style={styles.reasonBlock}>
          <Text style={styles.reasonLabel}>MOTIF (FACULTATIF)</Text>
          <TextInput
            style={styles.reasonInput}
            value={reason}
            onChangeText={setReason}
            placeholder="Mortalité terrain"
            placeholderTextColor={tokens.colors.field.disabled}
            maxLength={100}
          />
        </View>
      </View>

      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.validateButton, count === 0 && styles.stepButtonDisabled]}
          onPress={handleSubmit}
          disabled={count === 0}
          accessibilityRole="button"
          accessibilityLabel="Enregistrer la mortalité"
        >
          <Text style={styles.validateLabel}>Enregistrer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
  reasonBlock: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingVertical: tokens.spacing[4],
  },
  reasonLabel: {
    ...tokens.typography.label,
    color: tokens.colors.field.textMuted,
  },
  reasonInput: {
    ...tokens.typography.bodyLg,
    color: tokens.colors.field.text,
    minHeight: tokens.touch.field,
    marginTop: tokens.spacing[2],
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing[3],
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
