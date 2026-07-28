/**
 * Élevage › Œufs (ponte) — the layer overview, ported from the web
 * `/elevage/oeufs` page (same data): KPIs (laying flocks, hen headcount, full /
 * empty trays) and a card per layer unit. A layer unit is a POULTRY production
 * unit that isn't a broiler batch (`selectLayerUnits`). Tapping a card opens
 * the layer detail.
 */
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { Bird, ChevronRight, Egg, Package, PackageOpen } from 'lucide-react-native';
import { tokens } from '@/theme';
import { AppHeader } from '@/components/AppHeader';
import { KpiCard } from '@/components/ui';
import { useListProductionUnitsQuery, type ProductionUnit } from '@/store/api/productionUnitsApi';
import { useGetBatchesQuery } from '@/store/api/poultryBatchesApi';
import { useGetTrayStockQuery } from '@/store/api/eggProductionApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { formatNumber } from '@/lib/format';

const MS_PER_DAY = 86_400_000;
function ageInDays(startDate?: string): number {
  if (!startDate) return 0;
  const t = Date.parse(startDate);
  return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((Date.now() - t) / MS_PER_DAY));
}

export default function OeufsScreen() {
  const router = useRouter();
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const skip = selectedFarmId === null;

  const { data: units, isLoading } = useListProductionUnitsQuery(skip ? skipToken : selectedFarmId);
  const { data: batches } = useGetBatchesQuery(skip ? skipToken : { farmId: selectedFarmId });
  const { data: trayStock } = useGetTrayStockQuery(skip ? skipToken : { farmId: selectedFarmId });

  const layerUnits = useMemo(() => {
    const broilerIds = new Set((batches ?? []).map((b) => b.id));
    return (units ?? []).filter((u) => u.species === 'POULTRY' && !broilerIds.has(u.id));
  }, [units, batches]);

  const activeCount = layerUnits.filter((u) => u.status === 'ACTIVE').length;
  const flock = layerUnits.reduce((s, u) => s + u.currentCount, 0);

  if (selectedFarmId === null) return <Redirect href="/(field)" />;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Œufs (ponte)</Text>
        <Text style={styles.subtitle}>Suivez la ponte, le stock de plateaux et vos pondeuses.</Text>

        <View style={styles.kpiGrid}>
          <View style={styles.kpiCell}><KpiCard label="Lots en ponte" value={formatNumber(activeCount)} icon={Egg} tint={tokens.colors.accent[400]} /></View>
          <View style={styles.kpiCell}><KpiCard label="Cheptel pondeuses" value={formatNumber(flock)} icon={Bird} tint={tokens.colors.primary[500]} /></View>
          <View style={styles.kpiCell}><KpiCard label="Plateaux pleins" value={formatNumber(trayStock?.fullTraysCount ?? 0)} icon={Package} tint={tokens.colors.success} /></View>
          <View style={styles.kpiCell}><KpiCard label="Plateaux vides" value={formatNumber(trayStock?.emptyTraysCount ?? 0)} icon={PackageOpen} tint={tokens.colors.info} /></View>
        </View>

        <Text style={styles.section}>Lots de ponte</Text>
        {isLoading ? (
          <Text style={styles.muted}>Chargement…</Text>
        ) : layerUnits.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyDisc}><Egg size={28} color={tokens.colors.accent[400]} /></View>
            <Text style={styles.muted}>Aucun lot de ponte sur cette ferme.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {layerUnits.map((u: ProductionUnit) => (
              <Pressable
                key={u.id}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() => router.push(`/(field)/oeufs/${u.id}`)}
                accessibilityRole="button"
                accessibilityLabel={u.name}
              >
                <View style={styles.cardDisc}><Egg size={20} color={tokens.colors.accent[400]} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{u.name}</Text>
                  <Text style={styles.meta}>{formatNumber(u.currentCount)} pondeuses · J{ageInDays(u.startDate)}</Text>
                </View>
                <ChevronRight size={22} color={tokens.colors.neutral[400]} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[16] },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[1], marginBottom: tokens.spacing[4] },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[3] },
  kpiCell: { width: '47%', flexGrow: 1 },
  section: { ...tokens.typography.label, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[6], marginBottom: tokens.spacing[2] },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[4] },
  list: { gap: tokens.spacing[3] },
  card: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], backgroundColor: tokens.colors.neutral[0], borderRadius: tokens.radii.xl, borderWidth: 1, borderColor: tokens.colors.neutral[200], padding: tokens.spacing[4], shadowColor: '#1C1917', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardPressed: { opacity: 0.92 },
  cardDisc: { width: 44, height: 44, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.accent[50], alignItems: 'center', justifyContent: 'center' },
  name: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  meta: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 1 },
  emptyBox: { alignItems: 'center', paddingVertical: tokens.spacing[8], gap: tokens.spacing[3] },
  emptyDisc: { width: 64, height: 64, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.accent[50], alignItems: 'center', justifyContent: 'center' },
});
