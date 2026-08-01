/**
 * Farm identity: name, location, capacity, production focus. Persists to the
 * farm created at signup via updateFarm on Continue; gates advance on a
 * non-empty name.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bird, Check, Egg, Layers } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { tokens } from '@/theme';
import { FormField } from '@/components/field/FormField';
import { useListFarmsQuery, useUpdateFarmMutation } from '@/store/api/farmsApi';
import { useWizard } from '@/onboarding/wizardContext';
import { StepScaffold } from '../StepScaffold';

type Focus = 'broiler' | 'layer' | 'mixed';

const FOCUS_OPTIONS: { id: Focus; label: string; hint: string; icon: typeof Bird; tokens: string[] }[] = [
  { id: 'broiler', label: 'Chair', hint: 'Poulets de chair', icon: Bird, tokens: ['broiler'] },
  { id: 'layer', label: 'Ponte', hint: 'Poules pondeuses', icon: Egg, tokens: ['layer'] },
  { id: 'mixed', label: 'Mixte', hint: 'Chair et ponte', icon: Layers, tokens: ['broiler', 'layer'] },
];

export function FarmStep() {
  const { farmId, registerNext, setCanAdvance } = useWizard();
  const { data: farms } = useListFarmsQuery();
  const [updateFarm] = useUpdateFarmMutation();

  const farm = useMemo(() => farms?.find((f) => f.id === farmId), [farms, farmId]);

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [focus, setFocus] = useState<Focus>('broiler');
  const [error, setError] = useState<string | null>(null);
  const [prefilledId, setPrefilledId] = useState<number | null>(null);

  // Prefill once, when the farm loads.
  if (farm && prefilledId !== farm.id) {
    setPrefilledId(farm.id);
    setName(farm.name ?? '');
    setLocation(farm.location ?? '');
    setCapacity(farm.capacity != null ? String(farm.capacity) : '');
    const f = farm.productionFocus ?? [];
    setFocus(f.includes('broiler') && f.includes('layer') ? 'mixed' : f.includes('layer') ? 'layer' : 'broiler');
  }

  const valid = name.trim().length > 0;

  useEffect(() => {
    setCanAdvance(valid);
  }, [valid, setCanAdvance]);

  useEffect(() => {
    registerNext(async () => {
      if (!farmId || !valid) return false;
      setError(null);
      try {
        const t = FOCUS_OPTIONS.find((o) => o.id === focus)!.tokens;
        await updateFarm({
          id: farmId,
          body: {
            name: name.trim(),
            location: location.trim() || undefined,
            capacity: capacity ? Number(capacity) : undefined,
            productionFocus: t,
          },
        }).unwrap();
        return true;
      } catch {
        setError('Enregistrement impossible. Vérifiez votre connexion et réessayez.');
        return false;
      }
    });
  }, [farmId, valid, name, location, capacity, focus, updateFarm, registerNext]);

  return (
    <StepScaffold
      eyebrow="Étape 2 · Votre ferme"
      title="Parlez-nous de votre ferme"
      subtitle="Ces informations personnalisent vos tableaux de bord et vos alertes."
    >
      <View style={styles.form}>
        <FormField label="Nom de la ferme" required value={name} onChangeText={setName} placeholder="Ex. Ferme Ndiaye" />
        <FormField label="Localisation" value={location} onChangeText={setLocation} placeholder="Ex. Thiès, Sénégal" />
        <FormField
          label="Capacité (têtes)"
          value={capacity}
          onChangeText={(t) => setCapacity(t.replace(/[^0-9]/g, ''))}
          placeholder="Ex. 5000"
          keyboardType="number-pad"
        />

        <View>
          <Text style={styles.groupLabel}>Type de production</Text>
          <View style={styles.cards}>
            {FOCUS_OPTIONS.map((o) => {
              const selected = focus === o.id;
              const Icon = o.icon;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => {
                    setFocus(o.id);
                    void Haptics.selectionAsync();
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={o.label}
                  style={[styles.card, selected && styles.cardOn]}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.cardIcon, selected && styles.cardIconOn]}>
                      <Icon size={20} color={selected ? tokens.colors.primary[600] : tokens.colors.neutral[500]} />
                    </View>
                    <View style={[styles.radio, selected && styles.radioOn]}>
                      {selected ? <Check size={12} color={tokens.colors.neutral[0]} strokeWidth={3} /> : null}
                    </View>
                  </View>
                  <Text style={styles.cardLabel}>{o.label}</Text>
                  <Text style={styles.cardHint}>{o.hint}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.spacing[4] },
  groupLabel: { ...tokens.typography.label, color: tokens.colors.neutral[700], marginBottom: tokens.spacing[2] },
  cards: { flexDirection: 'row', gap: tokens.spacing[2] },
  card: {
    flex: 1,
    padding: tokens.spacing[3],
    borderRadius: tokens.radii.lg,
    borderWidth: 1.5,
    borderColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[0],
  },
  cardOn: { borderColor: tokens.colors.primary[500], backgroundColor: tokens.colors.primary[50] },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: tokens.spacing[2] },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconOn: { backgroundColor: tokens.colors.primary[100] },
  radio: {
    width: 20,
    height: 20,
    borderRadius: tokens.radii.full,
    borderWidth: 2,
    borderColor: tokens.colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: tokens.colors.primary[500], backgroundColor: tokens.colors.primary[500] },
  cardLabel: { ...tokens.typography.headingMd, color: tokens.colors.neutral[900] },
  cardHint: { ...tokens.typography.bodySm, color: tokens.colors.neutral[600] },
  error: { ...tokens.typography.bodySm, color: tokens.colors.error },
});
