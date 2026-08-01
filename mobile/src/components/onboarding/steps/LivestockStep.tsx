/**
 * Élevage: add the first lot(s). A batch is required to actually manage
 * production, so broiler-only or layer-only farms must add at least one lot of
 * their kind before continuing; mixed farms add either kind at will.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bird, Egg, Plus } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useListFarmsQuery } from '@/store/api/farmsApi';
import { useListBreedsQuery } from '@/store/api/breedsApi';
import { useGetBatchesQuery } from '@/store/api/poultryBatchesApi';
import { useListProductionUnitsQuery } from '@/store/api/productionUnitsApi';
import { useWizard } from '@/onboarding/wizardContext';
import { CreateLotSheet } from '../CreateLotSheet';
import { StepScaffold } from '../StepScaffold';

export function LivestockStep() {
  const { farmId, setCanAdvance } = useWizard();
  const { data: farms } = useListFarmsQuery();
  const { data: breeds } = useListBreedsQuery('POULTRY');
  const { data: batches } = useGetBatchesQuery(
    { farmId: farmId ?? 0 },
    { skip: farmId == null },
  );
  const { data: units } = useListProductionUnitsQuery(farmId ?? 0, {
    skip: farmId == null,
  });

  const [broilerOpen, setBroilerOpen] = useState(false);
  const [layerOpen, setLayerOpen] = useState(false);

  const focus = useMemo(
    () => farms?.find((f) => f.id === farmId)?.productionFocus ?? ['broiler', 'layer'],
    [farms, farmId],
  );
  const wantsBroiler = focus.includes('broiler');
  const wantsLayer = focus.includes('layer');
  const isMixed = wantsBroiler && wantsLayer;

  const layerBreedIds = useMemo(
    () => new Set((breeds ?? []).filter((b) => b.type === 'layer').map((b) => b.id)),
    [breeds],
  );
  const layerFlocks = useMemo(
    () => (units ?? []).filter((u) => u.breedId != null && layerBreedIds.has(u.breedId)),
    [units, layerBreedIds],
  );
  const broilerBatches = batches ?? [];

  const satisfied = isMixed
    ? true
    : wantsBroiler
      ? broilerBatches.length > 0
      : layerFlocks.length > 0;

  useEffect(() => {
    setCanAdvance(satisfied);
  }, [satisfied, setCanAdvance]);

  return (
    <StepScaffold
      eyebrow="Étape 3 · Élevage"
      title="Ajoutez votre premier lot"
      subtitle={
        isMixed
          ? 'Créez vos lots de chair et de ponte, comme vous le souhaitez.'
          : 'Un lot est nécessaire pour suivre votre production — ajoutez-en au moins un.'
      }
    >
      <View style={styles.sections}>
        {wantsBroiler ? (
          <LotSection
            icon={Bird}
            title="Poulets de chair"
            lots={broilerBatches.map((b) => ({ id: b.id, name: b.name ?? `Lot #${b.id}`, count: b.currentCount }))}
            onAdd={() => setBroilerOpen(true)}
            required={!isMixed}
          />
        ) : null}
        {wantsLayer ? (
          <LotSection
            icon={Egg}
            title="Poules pondeuses"
            lots={layerFlocks.map((u) => ({ id: u.id, name: u.name ?? `Lot #${u.id}`, count: u.currentCount }))}
            onAdd={() => setLayerOpen(true)}
            required={!isMixed}
          />
        ) : null}
      </View>

      {farmId != null ? (
        <>
          <CreateLotSheet visible={broilerOpen} kind="broiler" farmId={farmId} onClose={() => setBroilerOpen(false)} />
          <CreateLotSheet visible={layerOpen} kind="layer" farmId={farmId} onClose={() => setLayerOpen(false)} />
        </>
      ) : null}
    </StepScaffold>
  );
}

function LotSection({
  icon: Icon,
  title,
  lots,
  onAdd,
  required,
}: {
  icon: typeof Bird;
  title: string;
  lots: { id: number; name: string; count: number }[];
  onAdd: () => void;
  required: boolean;
}) {
  const empty = lots.length === 0;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconTile}>
          <Icon size={20} color={tokens.colors.primary[600]} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardMeta}>
            {lots.length} lot{lots.length > 1 ? 's' : ''}
          </Text>
        </View>
        <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel={`Ajouter un lot — ${title}`} style={styles.addBtn}>
          <Plus size={16} color={tokens.colors.primary[700]} />
          <Text style={styles.addText}>Ajouter</Text>
        </Pressable>
      </View>

      {empty ? (
        <Text style={[styles.hint, required && styles.hintRequired]}>
          {required ? 'Ajoutez au moins un lot pour continuer.' : "Aucun lot pour l'instant."}
        </Text>
      ) : (
        <View style={styles.lots}>
          {lots.map((l) => (
            <View key={l.id} style={styles.lotRow}>
              <Text style={styles.lotName}>{l.name}</Text>
              <Text style={styles.lotCount}>{l.count.toLocaleString('fr-FR')} têtes</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sections: { gap: tokens.spacing[3] },
  card: {
    padding: tokens.spacing[4],
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[0],
    gap: tokens.spacing[3],
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  cardTitle: { ...tokens.typography.headingMd, color: tokens.colors.neutral[900] },
  cardMeta: { ...tokens.typography.bodySm, color: tokens.colors.neutral[600] },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[1],
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.primary[50],
  },
  addText: { ...tokens.typography.bodyMd, color: tokens.colors.primary[700], fontFamily: tokens.typography.headingMd.fontFamily },
  hint: { ...tokens.typography.bodySm, color: tokens.colors.neutral[500] },
  hintRequired: { color: tokens.colors.accent[600], fontFamily: tokens.typography.headingMd.fontFamily },
  lots: { gap: tokens.spacing[2] },
  lotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.neutral[50],
  },
  lotName: { ...tokens.typography.bodyMd, color: tokens.colors.neutral[900] },
  lotCount: { ...tokens.typography.bodySm, color: tokens.colors.neutral[600], fontFamily: tokens.typography.numericSm.fontFamily },
});
