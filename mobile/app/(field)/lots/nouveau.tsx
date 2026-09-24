/**
 * Nouvelle bande de chair, atteignable depuis la liste des lots (pas seulement
 * l'onboarding) — comble un écart de parité avec le web (`CreateBatchDialog`).
 * Poulets de chair uniquement : les lots de ponte se créent ailleurs, hors
 * périmètre de ce coût.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { ArrowLeft } from 'lucide-react-native';
import { tokens } from '@/theme';
import { FormField } from '@/components/field/FormField';
import { ActionBar } from '@/components/field/ActionBar';
import { useListBreedsQuery } from '@/store/api/breedsApi';
import { useCreateBatchMutation } from '@/store/api/poultryBatchesApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { targetsForBreed } from '@/constants/breedDefaults';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function CreerBandeScreen() {
  const router = useRouter();
  const selectedFarmId = useSelector(selectSelectedFarmId);
  // Breeds are not farm-scoped (same query CreateLotSheet.tsx uses, unconditionally).
  const { data: breeds } = useListBreedsQuery('POULTRY');
  const [createBatch, { isLoading }] = useCreateBatchMutation();

  const broilerBreeds = (breeds ?? []).filter((b) => b.type === 'broiler');

  const [breedId, setBreedId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [count, setCount] = useState('');
  const [date, setDate] = useState(today());
  const [chickUnitPrice, setChickUnitPrice] = useState('');
  const [targetWeightG, setTargetWeightG] = useState('2000');
  const [targetAgeDays, setTargetAgeDays] = useState('42');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (broilerBreeds.length > 0 && breedId == null) {
      const first = broilerBreeds[0]!;
      setBreedId(first.id);
      const targets = targetsForBreed(first.code);
      setTargetWeightG(String(targets.targetWeightG));
      setTargetAgeDays(String(targets.targetAgeDays));
    }
  }, [broilerBreeds, breedId]);

  function selectBreed(id: number) {
    setBreedId(id);
    const breed = broilerBreeds.find((b) => b.id === id);
    const targets = targetsForBreed(breed?.code);
    setTargetWeightG(String(targets.targetWeightG));
    setTargetAgeDays(String(targets.targetAgeDays));
  }

  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }

  const valid = breedId != null && Number(count) > 0;
  const chickTotal =
    Number(chickUnitPrice) > 0 && Number(count) > 0
      ? Number(chickUnitPrice) * Number(count)
      : null;

  async function submit() {
    if (!valid || breedId == null || selectedFarmId === null) return;
    setError(null);
    try {
      await createBatch({
        farmId: selectedFarmId,
        body: {
          breedId,
          name: name.trim() || undefined,
          startDate: date,
          initialCount: Number(count),
          targetWeightG: Number(targetWeightG) || undefined,
          targetAgeDays: Number(targetAgeDays) || undefined,
          ...(Number(chickUnitPrice) > 0 ? { chickUnitPriceXof: Number(chickUnitPrice) } : {}),
        },
      }).unwrap();
      router.back();
    } catch {
      setError('Création impossible. Vérifiez votre connexion et réessayez.');
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retour">
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Nouveau lot de chair</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.groupLabel}>Souche</Text>
        <View style={styles.breeds}>
          {broilerBreeds.length === 0 ? (
            <Text style={styles.empty}>Aucune souche disponible.</Text>
          ) : (
            broilerBreeds.map((b) => {
              const on = breedId === b.id;
              return (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => selectBreed(b.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={b.name}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{b.name}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <FormField label="Nom du lot (optionnel)" value={name} onChangeText={setName} placeholder="Ex. Lot 1" />
        <FormField
          label="Effectif"
          required
          value={count}
          onChangeText={(t) => setCount(t.replace(/[^0-9]/g, ''))}
          placeholder="Ex. 500"
          keyboardType="number-pad"
        />
        <FormField label="Date d'arrivée" value={date} onChangeText={setDate} placeholder="AAAA-MM-JJ" />
        <FormField
          label="Poids cible (g)"
          value={targetWeightG}
          onChangeText={(t) => setTargetWeightG(t.replace(/[^0-9]/g, ''))}
          placeholder="Ex. 2000"
          keyboardType="number-pad"
        />
        <FormField
          label="Âge cible (jours)"
          value={targetAgeDays}
          onChangeText={(t) => setTargetAgeDays(t.replace(/[^0-9]/g, ''))}
          placeholder="Ex. 42"
          keyboardType="number-pad"
        />
        <FormField
          label="Prix par poussin (FCFA, optionnel)"
          value={chickUnitPrice}
          onChangeText={(t) => setChickUnitPrice(t.replace(/[^0-9]/g, ''))}
          placeholder="Ex. 300"
          keyboardType="number-pad"
          helperText={
            chickTotal != null
              ? `Total : ${chickTotal.toLocaleString('fr-FR')} FCFA`
              : 'Modifiable plus tard depuis la fiche du lot.'
          }
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <ActionBar>
        <TouchableOpacity
          style={[styles.cta, (!valid || isLoading) && styles.ctaDisabled]}
          onPress={submit}
          disabled={!valid || isLoading}
          accessibilityRole="button"
          accessibilityLabel="Créer le lot"
        >
          {isLoading ? (
            <ActivityIndicator color={tokens.colors.action.commit.fg} />
          ) : (
            <Text style={styles.ctaText}>Créer le lot</Text>
          )}
        </TouchableOpacity>
      </ActionBar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.field.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: tokens.layout.screenPadding, paddingVertical: tokens.spacing[3] },
  title: { ...tokens.typography.headingLg, color: tokens.colors.field.text },
  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[8], gap: tokens.spacing[4] },
  groupLabel: { ...tokens.typography.label, color: tokens.colors.neutral[700] },
  breeds: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  chip: { paddingHorizontal: tokens.spacing[4], paddingVertical: tokens.spacing[2], borderRadius: tokens.radii.full, borderWidth: 1.5, borderColor: tokens.colors.neutral[200], backgroundColor: tokens.colors.neutral[0] },
  chipOn: { borderColor: tokens.colors.primary[500], backgroundColor: tokens.colors.primary[50] },
  chipText: { ...tokens.typography.bodyMd, color: tokens.colors.neutral[700] },
  chipTextOn: { color: tokens.colors.primary[700], fontFamily: tokens.typography.headingMd.fontFamily },
  empty: { ...tokens.typography.bodySm, color: tokens.colors.neutral[500] },
  error: { ...tokens.typography.bodySm, color: tokens.colors.error },
  cta: { minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.action.commit.bg, alignItems: 'center', justifyContent: 'center' },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { ...tokens.typography.button, color: tokens.colors.action.commit.fg },
});
