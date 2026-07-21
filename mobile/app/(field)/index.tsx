/**
 * Farm selector — first field screen after the auth guard. "Vestibule"
 * posture (design direction §3): the one screen besides login allowed a
 * light header/logo, but the farm list itself already reads as a
 * feuille-de-poulailler sheet — thick 2dp rule separators, no cards.
 *
 * Picking a farm writes `selectedFarmId` (read by the batch list and every
 * later field screen) and navigates to `(field)/lots`. Switching away from a
 * previously-selected farm purges the persisted RTK Query cache first, so a
 * stale batch list from the old farm can never flash under the new one
 * (`@/store/persist`'s header explains why this lives here rather than in
 * the slice itself).
 */
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { tokens } from '@/theme';
import { useListFarmsQuery, type Farm } from '@/store/api/farmsApi';
import { selectSelectedFarmId, setSelectedFarmId } from '@/store/slices/selectionSlice';
import { baseApi } from '@/store/api/baseApi';
import { purgePersistedCache } from '@/store/persist';
import { persistor, type AppDispatch } from '@/store';

export default function FarmSelectorScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { data: farms, isLoading, isFetching } = useListFarmsQuery();

  const autoSelected = useRef(false);

  const selectFarm = async (farmId: number) => {
    // A different farm than the one already selected: the persisted cache
    // may hold that other farm's batches — wipe it before switching so
    // nothing from farm A can render under farm B.
    if (selectedFarmId !== null && selectedFarmId !== farmId) {
      dispatch(baseApi.util.resetApiState());
      await purgePersistedCache(persistor);
    }
    dispatch(setSelectedFarmId(farmId));
    router.push('/(field)/lots');
  };

  // Exactly one farm: skip the extra tap, but still show the row briefly —
  // the farmer should never wonder which farm they ended up in.
  useEffect(() => {
    const onlyFarm = farms?.length === 1 ? farms[0] : undefined;
    if (!autoSelected.current && onlyFarm) {
      autoSelected.current = true;
      void selectFarm(onlyFarm.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farms]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={tokens.colors.primary[600]} />
      </SafeAreaView>
    );
  }

  if (!farms || farms.length === 0) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.title}>AviCare</Text>
        <Text style={styles.empty}>Aucune ferme</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AviCare</Text>
        <Text style={styles.subtitle}>{isFetching ? 'Actualisation…' : 'Choisir une ferme'}</Text>
      </View>

      <View style={styles.rule} />

      {farms.map((farm: Farm) => (
        <View key={farm.id}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => void selectFarm(farm.id)}
            accessibilityRole="button"
            accessibilityLabel={farm.name}
          >
            <Text style={styles.farmName}>{farm.name}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.rule} />
        </View>
      ))}
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
    backgroundColor: tokens.colors.field.background,
    paddingHorizontal: tokens.layout.screenPadding,
  },
  header: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[6],
    paddingBottom: tokens.spacing[4],
  },
  title: {
    ...tokens.typography.displayLg,
    color: tokens.colors.field.text,
  },
  subtitle: {
    ...tokens.typography.bodyLg,
    color: tokens.colors.field.textMuted,
    marginTop: tokens.spacing[1],
  },
  empty: {
    ...tokens.typography.headingMd,
    color: tokens.colors.field.textMuted,
    marginTop: tokens.spacing[3],
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
  },
  farmName: {
    ...tokens.typography.headingLg,
    color: tokens.colors.field.text,
  },
  chevron: {
    ...tokens.typography.headingLg,
    color: tokens.colors.field.textMuted,
  },
});
