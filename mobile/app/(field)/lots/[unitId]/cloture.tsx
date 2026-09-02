/**
 * Closing a batch ("Clôturer la bande") — mirrors the web `CloseBatchDialog`.
 *
 * Online-only, unlike the field-entry screens: closing returns a computed report
 * the next screen has to show, and the offline queue can only replay a
 * fire-and-forget write. A cycle is closed once, from a place with signal.
 *
 * The chick cost is asked here because it is recorded nowhere else in the
 * platform, and it is the second-largest cost of a broiler cycle — without it
 * the report understates what the batch really cost.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Lock } from 'lucide-react-native';
import { tokens } from '@/theme';
import { FormField } from '@/components/field/FormField';
import { ActionBar } from '@/components/field/ActionBar';
import { useListProductionUnitsQuery } from '@/store/api/productionUnitsApi';
import { useCloseUnitMutation } from '@/store/api/closureApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useFarmAccess } from '@/auth/useSession';
import { formatNumber } from '@/lib/format';

export default function CloseBatchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ unitId: string }>();
  const rawUnitId = Array.isArray(params.unitId) ? params.unitId[0] : params.unitId;
  const unitId = rawUnitId ? Number(rawUnitId) : NaN;

  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { farmRole } = useFarmAccess();

  const { data: units } = useListProductionUnitsQuery(selectedFarmId ?? skipToken);
  const unit = units?.find((u) => u.id === unitId);

  const [closeUnit, { isLoading }] = useCloseUnitMutation();
  const [chickCost, setChickCost] = useState('');
  const [notes, setNotes] = useState('');

  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }

  // Closing is structuring, like creating a unit — OWNER/MANAGER only, same as the backend.
  const canClose = farmRole === 'OWNER' || farmRole === 'MANAGER';
  const digitsOnly = /^\d*$/.test(chickCost);
  const canSubmit = !Number.isNaN(unitId) && canClose && digitsOnly && !isLoading;

  async function handleSubmit(): Promise<void> {
    if (selectedFarmId === null || !canSubmit) return;
    try {
      await closeUnit({
        farmId: selectedFarmId,
        unitId,
        body: {
          chickCostXof: chickCost ? Number(chickCost) : undefined,
          notes: notes.trim() || undefined,
        },
      }).unwrap();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      const message =
        (err as { data?: { detail?: string; message?: string } })?.data?.detail ??
        (err as { data?: { message?: string } })?.data?.message ??
        'La bande n’a pas pu être clôturée. Vérifiez votre connexion et réessayez.';
      Alert.alert('Clôture', message);
    }
  }

  const subtitle = unit ? `Lot ${unit.name}` : 'Lot';

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
          <Text style={styles.title}>Clôturer la bande</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.notice}>
          <Lock size={18} color={tokens.colors.field.textMuted} />
          <Text style={styles.noticeText}>
            Le bilan sera <Text style={styles.noticeStrong}>figé</Text> au moment de la clôture.
            Une dépense saisie plus tard ne le modifiera plus. Vous pourrez rouvrir la bande, ce
            qui supprimera le bilan.
          </Text>
        </View>

        {!!unit && unit.currentCount > 0 && (
          <View style={[styles.notice, styles.noticeWarn]}>
            <Text style={styles.noticeText}>
              Il reste {formatNumber(unit.currentCount)} sujets sur cette bande. Ils seront
              comptés comme produits dans le bilan.
            </Text>
          </View>
        )}

        {!canClose && (
          <View style={[styles.notice, styles.noticeWarn]}>
            <Text style={styles.noticeText}>
              Seul un propriétaire ou un gestionnaire peut clôturer une bande.
            </Text>
          </View>
        )}

        <FormField
          label="Coût des poussins (facultatif)"
          value={chickCost}
          onChangeText={setChickCost}
          placeholder="0"
          keyboardType="number-pad"
          maxLength={12}
          error={digitsOnly ? undefined : 'Nombre entier requis'}
          helperText="Non enregistré ailleurs. Sans lui, le coût du lot est sous-estimé."
        />

        <FormField
          label="Note (facultatif)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Observations de fin de bande…"
          multiline
          maxLength={2000}
        />
      </ScrollView>

      <ActionBar>
        <TouchableOpacity
          style={[styles.validateButton, !canSubmit && styles.validateButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Clôturer la bande"
        >
          {isLoading ? (
            <ActivityIndicator color={tokens.colors.action.commit.fg} />
          ) : (
            <Text style={styles.validateLabel}>Clôturer</Text>
          )}
        </TouchableOpacity>
      </ActionBar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[3],
    paddingBottom: tokens.spacing[3],
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: tokens.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.neutral[0],
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
  },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },

  content: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[2],
    paddingBottom: tokens.spacing[8],
    gap: tokens.spacing[4],
  },

  notice: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
    alignItems: 'flex-start',
    padding: tokens.spacing[4],
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.neutral[0],
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
  },
  noticeWarn: { backgroundColor: tokens.colors.warningLight, borderColor: tokens.colors.warning },
  noticeText: { ...tokens.typography.bodySm, color: tokens.colors.field.text, flex: 1, lineHeight: 20 },
  noticeStrong: { fontWeight: '700' },

  validateButton: {
    minHeight: tokens.touch.cta,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.action.commit.bg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.commit.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validateButtonDisabled: { opacity: 0.4 },
  validateLabel: { ...tokens.typography.button, color: tokens.colors.action.commit.fg },
});
