/**
 * Bottom-sheet to create the first lot of a kind during onboarding: pick a
 * breed, name it, set the headcount and start date, and submit through the
 * matching create endpoint (broiler batch / layer production unit).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { tokens } from '@/theme';
import { FormField } from '@/components/field/FormField';
import { useListBreedsQuery } from '@/store/api/breedsApi';
import { useCreateBatchMutation } from '@/store/api/poultryBatchesApi';
import { useCreateProductionUnitMutation } from '@/store/api/productionUnitsApi';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CreateLotSheet({
  visible,
  kind,
  farmId,
  onClose,
}: {
  visible: boolean;
  kind: 'broiler' | 'layer';
  farmId: number;
  onClose: () => void;
}) {
  const { data: breeds } = useListBreedsQuery('POULTRY');
  const [createBatch, { isLoading: creatingBatch }] = useCreateBatchMutation();
  const [createUnit, { isLoading: creatingUnit }] = useCreateProductionUnitMutation();

  const options = useMemo(
    () => (breeds ?? []).filter((b) => b.type === kind),
    [breeds, kind],
  );

  const [breedId, setBreedId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [count, setCount] = useState('');
  const [date, setDate] = useState(today());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setBreedId(null);
      setName('');
      setCount('');
      setDate(today());
      setError(null);
    }
  }, [visible]);

  const valid = breedId != null && Number(count) > 0;
  const busy = creatingBatch || creatingUnit;

  async function submit() {
    if (!valid || breedId == null) return;
    setError(null);
    const body = {
      breedId,
      name: name.trim() || undefined,
      startDate: date,
      initialCount: Number(count),
    };
    try {
      if (kind === 'broiler') {
        await createBatch({ farmId, body }).unwrap();
      } else {
        await createUnit({ farmId, body }).unwrap();
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      setError("Création impossible. Vérifiez votre connexion et réessayez.");
    }
  }

  const title = kind === 'broiler' ? 'Nouveau lot de chair' : 'Nouveau lot de ponte';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fermer">
            <X size={22} color={tokens.colors.neutral[500]} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.groupLabel}>Souche</Text>
          <View style={styles.breeds}>
            {options.length === 0 ? (
              <Text style={styles.empty}>Aucune souche disponible.</Text>
            ) : (
              options.map((b) => {
                const on = breedId === b.id;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => setBreedId(b.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={b.name}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{b.name}</Text>
                  </Pressable>
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

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={submit}
            disabled={!valid || busy}
            accessibilityRole="button"
            accessibilityLabel="Créer le lot"
            style={[styles.cta, (!valid || busy) && styles.ctaDisabled]}
          >
            {busy ? (
              <ActivityIndicator color={tokens.colors.action.commit.fg} />
            ) : (
              <Text style={styles.ctaText}>Créer le lot</Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(18,43,18,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    backgroundColor: tokens.colors.neutral[0],
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    paddingHorizontal: tokens.spacing[5],
    paddingTop: tokens.spacing[4],
    paddingBottom: tokens.spacing[8],
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: tokens.spacing[3] },
  title: { ...tokens.typography.headingLg, color: tokens.colors.neutral[900] },
  body: { gap: tokens.spacing[4] },
  groupLabel: { ...tokens.typography.label, color: tokens.colors.neutral[700] },
  breeds: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  chip: {
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[2],
    borderRadius: tokens.radii.full,
    borderWidth: 1.5,
    borderColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[0],
  },
  chipOn: { borderColor: tokens.colors.primary[500], backgroundColor: tokens.colors.primary[50] },
  chipText: { ...tokens.typography.bodyMd, color: tokens.colors.neutral[700] },
  chipTextOn: { color: tokens.colors.primary[700], fontFamily: tokens.typography.headingMd.fontFamily },
  empty: { ...tokens.typography.bodySm, color: tokens.colors.neutral[500] },
  error: { ...tokens.typography.bodySm, color: tokens.colors.error },
  cta: {
    minHeight: tokens.touch.primaryButton,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.action.commit.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing[2],
  },
  ctaDisabled: { backgroundColor: tokens.colors.neutral[300] },
  ctaText: { ...tokens.typography.button, color: tokens.colors.action.commit.fg },
});
