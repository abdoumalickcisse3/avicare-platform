/**
 * Batch (production-unit) list for the selected farm — "Navigation" posture
 * (design direction §3): flat white sheet, rows separated by 2dp rules, key
 * numbers in `numericSm`, no cards.
 *
 * Offline behaviour (task 8's core requirement): RTK Query never clears
 * `data` on a failed refetch — the reducer only updates `error`/`status` on
 * a rejection, the last successful payload stays in the cache and keeps
 * flowing through `useListProductionUnitsQuery`. Combined with the
 * `redux-persist` whitelist on the `api` slice (`@/store/persist`), that
 * cache also survives an app restart while offline. This screen therefore
 * never blanks on error: it renders whatever `data` holds and only adds a
 * subtle "hors ligne" hint when a fetch failed on top of existing data.
 */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { tokens } from '@/theme';
import { useListProductionUnitsQuery, type ProductionUnit } from '@/store/api/productionUnitsApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';

export default function BatchListScreen() {
  const router = useRouter();
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const {
    data: units,
    isLoading,
    isError,
  } = useListProductionUnitsQuery(selectedFarmId ?? skipToken);

  // No farm picked yet (e.g. a cold deep link into /(field)/lots) — send
  // back to the selector rather than querying an invalid farmId.
  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }

  const stale = isError && units !== undefined;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Lots</Text>
        {stale ? <Text style={styles.staleHint}>Hors ligne — données en cache</Text> : null}
      </View>

      <View style={styles.rule} />

      {isLoading ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>Chargement…</Text>
        </View>
      ) : !units || units.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>Aucun lot actif</Text>
        </View>
      ) : (
        units.map((unit: ProductionUnit) => (
          <View key={unit.id}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/(field)/lots/${unit.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${unit.name}, ${unit.currentCount} têtes`}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.unitName}>{unit.name}</Text>
                <Text style={styles.unitMeta}>
                  {unit.species} · {unit.status}
                </Text>
              </View>
              <Text style={styles.count}>{unit.currentCount}</Text>
            </TouchableOpacity>
            <View style={styles.rule} />
          </View>
        ))
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.field.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.layout.screenPadding,
  },
  header: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[6],
    paddingBottom: tokens.spacing[4],
  },
  title: {
    ...tokens.typography.displayMd,
    color: tokens.colors.field.text,
  },
  staleHint: {
    ...tokens.typography.bodySm,
    color: tokens.colors.accent[600],
    marginTop: tokens.spacing[1],
  },
  empty: {
    ...tokens.typography.headingMd,
    color: tokens.colors.field.textMuted,
  },
  rule: {
    height: tokens.layout.ruleWidth,
    backgroundColor: tokens.colors.field.rule,
  },
  row: {
    minHeight: tokens.touch.field,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.layout.screenPadding,
    paddingVertical: tokens.spacing[4],
    gap: tokens.spacing[3],
  },
  rowLeft: {
    flex: 1,
  },
  unitName: {
    ...tokens.typography.headingMd,
    color: tokens.colors.field.text,
  },
  unitMeta: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.field.textMuted,
    marginTop: tokens.spacing[1],
  },
  count: {
    ...tokens.typography.numericSm,
    color: tokens.colors.field.text,
  },
});
