/**
 * Formules d'aliment — mobile port of the web `/stocks/formules`
 * (`feedFormulasApi.getAvailableFormulas`). Lists the farm's feed formulas as
 * cards (phase, cost / 100 kg, ingredient count, total %), lets you clone a
 * platform template to get started, and — per formula — recompute the cost or
 * deactivate it. Composing a formula from scratch (ingredient editor) stays on
 * the web. Writes need `inventory:write` (OWNER / MANAGER).
 */
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft, Check, Copy, MoreVertical, Pencil, Wheat } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import {
  useDeactivateFeedFormulaMutation,
  useGetAvailableFormulasQuery,
  useRecomputeFormulaCostMutation,
} from '@/store/api/feedFormulasApi';
import { useGetPlatformFormulasQuery } from '@/store/api/inventoryCatalogApi';
import { useCloneFeedFormulaMutation } from '@/store/api/feedFormulasApi';
import { formatCurrency } from '@/lib/format';
import { FEED_PHASE_LABELS } from '@/lib/inventory';
import type { FarmFeedFormula } from '@/types';

export default function FormulesScreen() {
  const router = useRouter();
  const { can } = useFarmAccess();
  const canWrite = can('inventory:write');
  const selectedFarmId = useSelector(selectSelectedFarmId);

  const arg = selectedFarmId === null ? skipToken : { farmId: selectedFarmId };
  const { data, isLoading } = useGetAvailableFormulasQuery(arg);
  const { data: templates = [] } = useGetPlatformFormulasQuery(arg);
  const [clone, { isLoading: cloning }] = useCloneFeedFormulaMutation();
  const [recompute] = useRecomputeFormulaCostMutation();
  const [deactivate] = useDeactivateFeedFormulaMutation();

  const [cloneOpen, setCloneOpen] = useState(false);
  const [sourceKey, setSourceKey] = useState('');
  const [newName, setNewName] = useState('');

  const farmFormulas = useMemo(() => data?.farmFormulas ?? [], [data]);

  if (selectedFarmId === null) return <Redirect href="/(field)" />;

  const openClone = () => {
    setSourceKey(templates[0]?.key ?? '');
    setNewName('');
    setCloneOpen(true);
  };

  const submitClone = async () => {
    if (!sourceKey) return;
    try {
      await clone({ farmId: selectedFarmId, body: { sourceFormulaKey: sourceKey, newName: newName.trim() || undefined } }).unwrap();
      setCloneOpen(false);
    } catch {
      Alert.alert('Formule', "Le clonage a échoué. Réessayez.");
    }
  };

  const openActions = (f: FarmFeedFormula) => {
    Alert.alert(f.name, undefined, [
      {
        text: 'Modifier la composition',
        onPress: () => router.push(`/(field)/stocks/formule-edition?formulaId=${f.id}`),
      },
      {
        text: 'Recalculer le coût',
        onPress: async () => {
          try {
            await recompute({ farmId: selectedFarmId, id: f.id }).unwrap();
          } catch {
            Alert.alert('Formule', 'Le recalcul a échoué. Réessayez.');
          }
        },
      },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deactivate({ farmId: selectedFarmId, id: f.id }).unwrap();
          } catch {
            Alert.alert('Formule', 'La suppression a échoué. Réessayez.');
          }
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={8} style={styles.backBtn}>
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Formules d&apos;aliment</Text>
          <Text style={styles.subtitle}>Composez vos rations et suivez leurs coûts</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {canWrite && (
          <View style={styles.note}>
            <Wheat size={16} color={tokens.colors.primary[600]} />
            <Text style={styles.noteText}>
              Créez ou modifiez une formule ingrédient par ingrédient depuis l&apos;application web.
            </Text>
          </View>
        )}

        {isLoading ? (
          <Text style={styles.muted}>Chargement…</Text>
        ) : farmFormulas.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyDisc}>
              <Wheat size={28} color={tokens.colors.primary[600]} />
            </View>
            <Text style={styles.emptyText}>Aucune formule</Text>
            <Text style={styles.emptySub}>Clonez un modèle plateforme pour démarrer.</Text>
            {canWrite && (
              <Pressable accessibilityRole="button" accessibilityLabel="Cloner un modèle" onPress={openClone} style={styles.emptyCta}>
                <Text style={styles.emptyCtaLabel}>Cloner un modèle</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.list}>
            {farmFormulas.map((f, i) => (
              <Animated.View key={f.id} entering={FadeInDown.delay(i * 40).springify().damping(18)} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{f.name}</Text>
                    <View style={styles.metaRow}>
                      <View style={styles.phaseChip}>
                        <Text style={styles.phaseText}>{FEED_PHASE_LABELS[f.targetPhase]}</Text>
                      </View>
                      {f.sourceFormulaKey && <Text style={styles.cloned}>cloné</Text>}
                    </View>
                  </View>
                  <View style={styles.costCol}>
                    <Text style={styles.cost}>
                      {f.estimatedCostPer100kgXof != null ? formatCurrency(f.estimatedCostPer100kgXof) : '—'}
                    </Text>
                    <Text style={styles.costHint}>/ 100 kg</Text>
                  </View>
                </View>
                <View style={styles.cardBottom}>
                  <Text style={styles.ingredients}>
                    {f.ingredients.length} ingrédient{f.ingredients.length > 1 ? 's' : ''}
                    {f.totalPercentage != null ? ` · ${f.totalPercentage}%` : ''}
                  </Text>
                  {canWrite && (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Actions ${f.name}`} onPress={() => openActions(f)} hitSlop={8} style={styles.actionsBtn}>
                      <MoreVertical size={18} color={tokens.colors.field.textMuted} />
                    </Pressable>
                  )}
                </View>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      {canWrite && (
        <View style={styles.fabStack}>
          {/* Cloning a platform template is the shortcut; composing from scratch is the escape
              hatch when no template matches what the farm actually mixes. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Composer une formule"
            onPress={() => router.push('/(field)/stocks/formule-edition')}
            style={styles.fabSecondary}
          >
            <Pencil size={20} color={tokens.colors.field.text} />
          </Pressable>
          {farmFormulas.length > 0 && (
            <Pressable accessibilityRole="button" accessibilityLabel="Cloner un modèle" onPress={openClone} style={styles.fab}>
              <Copy size={22} color={tokens.colors.primary[900]} />
            </Pressable>
          )}
        </View>
      )}

      <Modal visible={cloneOpen} transparent animationType="slide" onRequestClose={() => setCloneOpen(false)}>
        <Pressable style={styles.backdrop} accessibilityLabel="Fermer" onPress={() => setCloneOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Cloner une formule</Text>
          <Text style={styles.sheetSub}>Partez d&apos;un modèle plateforme.</Text>

          <Text style={styles.fieldLabel}>Modèle</Text>
          {templates.length === 0 ? (
            <Text style={styles.muted}>Aucun modèle disponible.</Text>
          ) : (
            <ScrollView style={styles.templateScroll} keyboardShouldPersistTaps="handled">
              {templates.map((t) => {
                const on = t.key === sourceKey;
                return (
                  <Pressable
                    key={t.key}
                    accessibilityRole="button"
                    accessibilityLabel={t.label}
                    onPress={() => setSourceKey(t.key)}
                    style={styles.templateRow}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.templateName, on && styles.templateNameOn]}>{t.label}</Text>
                      <Text style={styles.templateMeta}>
                        {FEED_PHASE_LABELS[t.targetPhase as keyof typeof FEED_PHASE_LABELS] ?? t.targetPhase}
                        {t.estimatedCostPer100kgXof != null ? ` · ${formatCurrency(t.estimatedCostPer100kgXof)} / 100 kg` : ''}
                      </Text>
                    </View>
                    {on && <Check size={16} color={tokens.colors.primary[600]} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <Text style={styles.fieldLabel}>Nom (optionnel)</Text>
          <TextInput value={newName} onChangeText={setNewName} placeholder="Nom de la nouvelle formule" placeholderTextColor={tokens.colors.field.disabled} accessibilityLabel="Nom" style={styles.input} maxLength={80} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cloner la formule"
            onPress={submitClone}
            disabled={!sourceKey || cloning}
            style={[styles.commit, (!sourceKey || cloning) && styles.commitDisabled]}
          >
            <Text style={styles.commitLabel}>Cloner</Text>
          </Pressable>
        </View>
      </Modal>
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
    paddingBottom: tokens.spacing[2],
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

  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[16] },
  note: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], backgroundColor: tokens.colors.primary[50], borderRadius: tokens.radii.lg, padding: tokens.spacing[3], marginBottom: tokens.spacing[4] },
  noteText: { ...tokens.typography.bodySm, color: tokens.colors.primary[700], flex: 1 },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[6] },
  emptyBox: { alignItems: 'center', gap: tokens.spacing[2], paddingVertical: tokens.spacing[10] },
  emptyDisc: { width: 60, height: 60, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.primary[50], alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  emptySub: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, textAlign: 'center', paddingHorizontal: tokens.spacing[6] },
  emptyCta: { marginTop: tokens.spacing[3], minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.accent[400], alignItems: 'center', justifyContent: 'center', paddingHorizontal: tokens.spacing[6] },
  emptyCtaLabel: { ...tokens.typography.button, fontSize: 15, color: tokens.colors.primary[900] },

  list: { gap: tokens.spacing[3] },
  card: { backgroundColor: tokens.colors.neutral[0], borderRadius: tokens.radii.xl, borderWidth: 1, borderColor: tokens.colors.neutral[200], padding: tokens.spacing[4], gap: tokens.spacing[3] },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: tokens.spacing[2] },
  name: { ...tokens.typography.headingMd, fontSize: 16, color: tokens.colors.field.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], marginTop: 4 },
  phaseChip: { borderRadius: tokens.radii.full, backgroundColor: tokens.colors.primary[50], paddingHorizontal: tokens.spacing[2], paddingVertical: 2 },
  phaseText: { ...tokens.typography.bodySm, fontSize: 11, fontWeight: '600', color: tokens.colors.primary[700] },
  cloned: { ...tokens.typography.bodySm, fontSize: 11, color: tokens.colors.field.textMuted },
  costCol: { alignItems: 'flex-end' },
  cost: { ...tokens.typography.numericSm, fontSize: 16, color: tokens.colors.primary[600] },
  costHint: { ...tokens.typography.bodySm, fontSize: 11, color: tokens.colors.field.textMuted },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ingredients: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  actionsBtn: { padding: 2 },

  fabStack: {
    position: 'absolute',
    right: tokens.layout.screenPadding,
    bottom: tokens.spacing[6],
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  fabSecondary: {
    width: 52,
    height: 52,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.neutral[0],
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.accent[400],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: tokens.colors.primary[900],
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  backdrop: { flex: 1, backgroundColor: 'rgba(18,43,18,0.35)' },
  sheet: { backgroundColor: tokens.colors.neutral[0], borderTopLeftRadius: tokens.radii.xl, borderTopRightRadius: tokens.radii.xl, padding: tokens.layout.screenPadding, paddingBottom: tokens.spacing[8], gap: tokens.spacing[1] },
  sheetTitle: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  sheetSub: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginBottom: tokens.spacing[1] },
  fieldLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[2] },
  templateScroll: { maxHeight: 220, borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.neutral[200], marginTop: tokens.spacing[1] },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.neutral[100],
  },
  templateName: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  templateNameOn: { color: tokens.colors.primary[700], fontWeight: '700' },
  templateMeta: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 1 },
  input: { minHeight: 46, borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.neutral[300], paddingHorizontal: tokens.spacing[3], color: tokens.colors.field.text, ...tokens.typography.bodyMd },
  commit: { minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.accent[400], alignItems: 'center', justifyContent: 'center', marginTop: tokens.spacing[4] },
  commitDisabled: { opacity: 0.4 },
  commitLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.primary[900] },
});
