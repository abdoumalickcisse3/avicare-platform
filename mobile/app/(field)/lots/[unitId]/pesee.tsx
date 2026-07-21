/**
 * Weighing sample entry ("Pesée") — task 12.
 *
 * The one screen of the four (design direction §2.4) that does NOT use the
 * counter as its input mode: a weighing has no natural step size (~1850g,
 * nothing to increment by), so it gets a numeric keypad DRAWN IN THE
 * SCREEN — never the system keyboard, which would cover the thumb zone
 * (§2.3) and closes unreliably with wet/gloved hands.
 *
 * Flow: type a weight on the keypad (`pendingDigits`), "Ajouter" pushes it
 * onto `weights` and clears the pad for the next bird — quick successive
 * entry, no navigation between samples. Each row in the list can be deleted
 * (a mis-typed value). The live average recomputes on every add/delete.
 * "Enregistrer" pushes the whole sample once.
 *
 * clientRef semantics mirror mortality (task 11): the weighing endpoint has
 * the same server-side replay dedup (Task 2) on a `client_ref` carried in
 * the body, so this screen mints ONE ref per submission and reuses it
 * verbatim in both the payload and `enqueueFieldMutation`.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
/** A weighing is a handful of digits in grams; five digits already covers a very heavy bird. */
const MAX_DIGITS = 5;

const KEYPAD_ROWS: readonly (readonly string[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['⌫', '0'],
];

/** Duplicated on purpose — see journalier.tsx's identical helper for why. */
function ageInDays(startDate: string | null | undefined): number | null {
  if (!startDate) return null;
  const start = Date.parse(startDate);
  if (Number.isNaN(start)) return null;
  return Math.max(0, Math.floor((Date.now() - start) / MS_PER_DAY));
}

/** Today's date as `YYYY-MM-DD` — see journalier.tsx's identical helper for why local, not UTC. */
function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function WeighingEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ unitId: string }>();
  const rawUnitId = Array.isArray(params.unitId) ? params.unitId[0] : params.unitId;
  const unitId = rawUnitId ? Number(rawUnitId) : NaN;

  const selectedFarmId = useSelector(selectSelectedFarmId);

  const { data: units } = useListProductionUnitsQuery(selectedFarmId ?? skipToken);
  const unit = units?.find((u) => u.id === unitId);

  const [weights, setWeights] = useState<number[]>([]);
  const [pendingDigits, setPendingDigits] = useState('');
  const [notes, setNotes] = useState('');

  // Hooks above run unconditionally (rules of hooks); the redirect below
  // only happens once every hook ran, same as the other field screens.
  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }

  function pressDigit(d: string): void {
    setPendingDigits((cur) => (cur.length >= MAX_DIGITS ? cur : cur + d));
  }

  function pressBackspace(): void {
    setPendingDigits((cur) => cur.slice(0, -1));
  }

  function addPendingWeight(): void {
    const n = Number(pendingDigits);
    if (pendingDigits === '' || !Number.isInteger(n) || n <= 0) return;
    setWeights((cur) => [...cur, n]);
    setPendingDigits('');
  }

  function removeWeight(index: number): void {
    setWeights((cur) => cur.filter((_, i) => i !== index));
  }

  function handleSubmit(): void {
    // Backend requires a non-empty list of positive integers (@NotEmpty
    // List<@Positive Integer>) — nothing to send with an empty sample.
    if (selectedFarmId === null || Number.isNaN(unitId) || weights.length === 0) return;

    const ref = Crypto.randomUUID();
    enqueueFieldMutation({
      farmId: selectedFarmId,
      kind: 'WEIGHING',
      endpoint: `/api/v1/farms/${selectedFarmId}/poultry-batches/${unitId}/weighings`,
      payload: {
        sampleDate: todayIsoDate(),
        individualWeights: weights,
        notes: notes.trim() || undefined,
        clientRef: ref,
      },
      clientRef: ref,
    });

    setWeights([]);
    setPendingDigits('');
    setNotes('');
    router.back();
  }

  const age = ageInDays(unit?.startDate);
  const headerLabel = unit ? `Lot ${unit.name}${age !== null ? ` · J${age}` : ''}` : 'Lot';
  const average = weights.length > 0 ? Math.round(weights.reduce((sum, w) => sum + w, 0) / weights.length) : null;

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
        <Text style={styles.title}>Pesée</Text>
      </View>

      <View style={styles.rule} />

      <View style={styles.content}>
        <View style={styles.displayBlock}>
          <Text style={styles.displayLabel}>POIDS (G)</Text>
          <Text style={styles.displayValue}>{pendingDigits || '0'}</Text>
          <Text style={styles.displayConsequence}>
            {average !== null ? `Moyenne : ${average} g (${weights.length} pesées)` : 'Aucune pesée enregistrée'}
          </Text>
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {weights.map((w, index) => (
            <View key={`${index}-${w}`} style={styles.weightRow}>
              <Text style={styles.weightValue}>{w} g</Text>
              <TouchableOpacity
                onPress={() => removeWeight(index)}
                accessibilityRole="button"
                accessibilityLabel={`Supprimer la pesée ${w} grammes`}
                hitSlop={{
                  top: tokens.spacing[2],
                  bottom: tokens.spacing[2],
                  left: tokens.spacing[2],
                  right: tokens.spacing[2],
                }}
              >
                <Text style={styles.weightDelete}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.rule} />

      {/* In-screen numeric keypad — always visible, never the system
          keyboard (design direction §2.4). */}
      <View style={styles.keypadBlock}>
        {KEYPAD_ROWS.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((key) =>
              key === '⌫' ? (
                <TouchableOpacity
                  key={key}
                  style={styles.keypadKey}
                  onPress={pressBackspace}
                  accessibilityRole="button"
                  accessibilityLabel="Effacer le dernier chiffre"
                >
                  <Text style={styles.keypadKeyLabel}>⌫</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  key={key}
                  style={styles.keypadKey}
                  onPress={() => pressDigit(key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Chiffre ${key}`}
                >
                  <Text style={styles.keypadKeyLabel}>{key}</Text>
                </TouchableOpacity>
              ),
            )}
          </View>
        ))}

        <TouchableOpacity
          style={[styles.addButton, pendingDigits === '' && styles.stepButtonDisabled]}
          onPress={addPendingWeight}
          disabled={pendingDigits === ''}
          accessibilityRole="button"
          accessibilityLabel="Ajouter la pesée à la liste"
        >
          <Text style={styles.addButtonLabel}>Ajouter</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Remarque (facultatif)"
          placeholderTextColor={tokens.colors.field.disabled}
          maxLength={200}
        />
      </View>

      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.validateButton, weights.length === 0 && styles.stepButtonDisabled]}
          onPress={handleSubmit}
          disabled={weights.length === 0}
          accessibilityRole="button"
          accessibilityLabel="Enregistrer la pesée"
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
  displayBlock: {
    alignItems: 'center',
    paddingHorizontal: tokens.layout.screenPadding,
    paddingVertical: tokens.spacing[5],
  },
  displayLabel: {
    ...tokens.typography.label,
    color: tokens.colors.field.textMuted,
  },
  displayValue: {
    ...tokens.typography.numeric,
    color: tokens.colors.field.text,
    marginTop: tokens.spacing[2],
  },
  displayConsequence: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.field.textMuted,
    marginTop: tokens.spacing[2],
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: tokens.layout.screenPadding,
    gap: tokens.spacing[2],
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing[2],
    borderBottomWidth: tokens.layout.ruleWidth,
    borderBottomColor: tokens.colors.field.ruleSubtle,
  },
  weightValue: {
    ...tokens.typography.bodyLg,
    color: tokens.colors.field.text,
  },
  weightDelete: {
    ...tokens.typography.headingMd,
    color: tokens.colors.action.danger.bg,
    paddingHorizontal: tokens.spacing[2],
  },
  keypadBlock: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingVertical: tokens.spacing[3],
    gap: tokens.spacing[2],
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: tokens.spacing[2],
  },
  keypadKey: {
    width: tokens.touch.keypadKey,
    height: tokens.touch.keypadKey,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.md,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.secondary.border,
    backgroundColor: tokens.colors.action.secondary.bg,
  },
  keypadKeyLabel: {
    ...tokens.typography.headingLg,
    color: tokens.colors.action.secondary.fg,
  },
  addButton: {
    minHeight: tokens.touch.field,
    borderRadius: tokens.radii.md,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.accumulate.border,
    backgroundColor: tokens.colors.action.accumulate.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonLabel: {
    ...tokens.typography.button,
    color: tokens.colors.action.accumulate.fg,
  },
  stepButtonDisabled: {
    opacity: 0.4,
  },
  notesInput: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.field.text,
    minHeight: tokens.touch.field,
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
