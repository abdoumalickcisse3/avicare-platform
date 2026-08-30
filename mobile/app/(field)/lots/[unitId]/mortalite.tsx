/**
 * Mortality entry ("Mortalité") — a faithful replica of the web form style
 * (labeled date/number/text fields, Annuler / Enregistrer footer). There is no
 * dedicated web mortality dialog (mortality is a field of the daily record), so
 * this mirrors that field plus an optional reason, posting to the generic
 * production-unit mortality endpoint.
 *
 * clientRef semantics (doc 08 §9 / Task 2 backend dedup): every "Enregistrer"
 * is its OWN distinct attrition event, so each submission mints a FRESH
 * clientRef, put in the request payload AND handed to `enqueueFieldMutation`
 * verbatim — the server's replay dedup on `client_ref` then protects this exact
 * event and never merges it with a neighbour.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import * as Crypto from 'expo-crypto';
import { ArrowLeft } from 'lucide-react-native';
import { tokens } from '@/theme';
import { FormField, TodayDateField } from '@/components/field/FormField';
import { ActionBar } from '@/components/field/ActionBar';
import { Counter } from '@/components/field/Counter';
import { useListProductionUnitsQuery } from '@/store/api/productionUnitsApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { formatNumber } from '@/lib/format';
import { enqueueFieldMutation } from '@/field/enqueueMutation';

const MS_PER_DAY = 86_400_000;

/** Duplicated on purpose — see journalier.tsx's identical helper for why. */
function ageInDays(startDate: string | null | undefined): number | null {
  if (!startDate) return null;
  const start = Date.parse(startDate);
  if (Number.isNaN(start)) return null;
  return Math.max(0, Math.floor((Date.now() - start) / MS_PER_DAY));
}

/** Today's date as `YYYY-MM-DD` — see journalier.tsx for why local, not UTC. */
function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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

  // The backend requires a strictly positive count (@Positive), and the counter cannot go
  // below zero — so "at least one" is the only rule left to state here.
  const canSubmit = !Number.isNaN(unitId) && count >= 1;

  function handleSubmit(): void {
    if (selectedFarmId === null || !canSubmit) return;

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
  const subtitle = unit ? `Lot ${unit.name}${age !== null ? ` · J${age}` : ''}` : 'Lot';
  const effectifHelper = unit
    ? `Effectif actuel : ${formatNumber(unit.currentCount)} sujets`
    : 'Effectif indisponible hors ligne';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Mortalité</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TodayDateField />
        {/* A counter rather than a text field: mortality is counted as the birds are found,
            one at a time, with one hand — not typed once on a phone keyboard that hides the
            value it is entering. Long press steps by ten for a bad morning. */}
        <Counter
          label="Mortalité constatée"
          value={count}
          onChange={setCount}
          max={unit?.currentCount}
          helperText={effectifHelper}
        />
        <FormField
          label="Motif (facultatif)"
          value={reason}
          onChangeText={setReason}
          placeholder="Prédateur, maladie, écrasement…"
          maxLength={100}
        />
      </ScrollView>

      {/* One commit action, in the thumb zone. Cancel moved into the header's back arrow:
          the design's golden rule is a single committing button per screen, and a "Annuler"
          sitting next to "Enregistrer" is the pair people mis-tap in a hurry. */}
      <ActionBar>
        <TouchableOpacity
          style={[styles.validateButton, !canSubmit && styles.validateButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Enregistrer la mortalité"
        >
          <Text style={styles.validateLabel}>Enregistrer</Text>
        </TouchableOpacity>
      </ActionBar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  header: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[3], paddingBottom: tokens.spacing[3] },
  backBtn: { width: 40, height: 40, borderRadius: tokens.radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200] },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },

  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[8], gap: tokens.spacing[4] },

  validateButton: { minHeight: tokens.touch.cta, borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.action.commit.bg, borderWidth: tokens.layout.borderWidth, borderColor: tokens.colors.action.commit.border, alignItems: 'center', justifyContent: 'center' },
  validateButtonDisabled: { opacity: 0.4 },
  validateLabel: { ...tokens.typography.button, color: tokens.colors.action.commit.fg },
});
