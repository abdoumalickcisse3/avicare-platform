/**
 * Farm selector — the screen that picks the farm the field app operates on.
 * Redesigned to the Stitch "Liste des fermes" reference: a header + a stack of
 * modern farm cards (green banner + status pill, name + location, focus chips,
 * a "Gérer l'exploitation" affordance). Tapping a card selects the farm and
 * enters the tabbed app.
 *
 * Switching away from a previously-selected farm purges the persisted RTK
 * Query cache first, so a stale list from the old farm can never flash under
 * the new one.
 */
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowRight, Bird, Egg, MapPin, Warehouse } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useListFarmsQuery, type Farm } from '@/store/api/farmsApi';
import { selectSelectedFarmId, setSelectedFarmId } from '@/store/slices/selectionSlice';
import { baseApi } from '@/store/api/baseApi';
import { purgePersistedCache } from '@/store/persist';
import { persistor, type AppDispatch } from '@/store';

const FOCUS: Record<string, { label: string; icon: typeof Bird }> = {
  broiler: { label: 'Chair', icon: Bird },
  layer: { label: 'Ponte', icon: Egg },
};

export default function FarmSelectorScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { data: farms, isLoading, isFetching } = useListFarmsQuery();

  const autoSelected = useRef(false);

  const selectFarm = async (farmId: number) => {
    if (selectedFarmId !== null && selectedFarmId !== farmId) {
      dispatch(baseApi.util.resetApiState());
      await purgePersistedCache(persistor);
    }
    dispatch(setSelectedFarmId(farmId));
    router.push('/(field)/(tabs)/home');
  };

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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes fermes</Text>
        <Text style={styles.subtitle}>
          {isFetching ? 'Actualisation…' : 'Choisissez une exploitation à gérer.'}
        </Text>
      </View>

      {!farms || farms.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyDisc}><Warehouse size={30} color={tokens.colors.primary[600]} /></View>
          <Text style={styles.emptyTitle}>Aucune ferme</Text>
          <Text style={styles.emptyText}>Créez votre première ferme depuis l&apos;application web pour commencer.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {farms.map((farm: Farm) => {
            const active = farm.active !== false;
            const focus = (farm.productionFocus ?? [])
              .map((f) => FOCUS[f])
              .filter((x): x is (typeof FOCUS)[string] => x !== undefined);
            return (
              <Pressable
                key={farm.id}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() => void selectFarm(farm.id)}
                accessibilityRole="button"
                accessibilityLabel={`Ouvrir ${farm.name}`}
              >
                {/* Banner */}
                <View style={styles.banner}>
                  <View style={styles.bannerCircle} />
                  <View style={styles.bannerIcon}>
                    <Warehouse size={22} color="#FFFFFF" />
                  </View>
                  <View style={[styles.statusPill, !active && styles.statusPillOff]}>
                    <View style={[styles.statusDot, { backgroundColor: active ? '#FFFFFF' : tokens.colors.neutral[300] }]} />
                    <Text style={styles.statusText}>{active ? 'Opérationnel' : 'Inactif'}</Text>
                  </View>
                </View>

                {/* Body */}
                <View style={styles.body}>
                  <Text style={styles.name} numberOfLines={1}>{farm.name}</Text>
                  <View style={styles.locRow}>
                    <MapPin size={14} color={tokens.colors.field.textMuted} />
                    <Text style={styles.loc} numberOfLines={1}>{farm.location || 'Localisation non renseignée'}</Text>
                  </View>

                  {focus.length > 0 && (
                    <View style={styles.chips}>
                      {focus.map((f) => {
                        const Icon = f.icon;
                        return (
                          <View key={f.label} style={styles.chip}>
                            <Icon size={13} color={tokens.colors.primary[700]} />
                            <Text style={styles.chipText}>{f.label}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  <View style={styles.divider} />
                  <View style={styles.footer}>
                    <Text style={styles.manage}>Gérer l&apos;exploitation</Text>
                    <ArrowRight size={18} color={tokens.colors.primary[600]} />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.neutral[50] },
  header: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[6], paddingBottom: tokens.spacing[4] },
  title: { ...tokens.typography.displayLg, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodyLg, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[1] },
  list: { paddingHorizontal: tokens.layout.screenPadding, paddingBottom: tokens.spacing[16], gap: tokens.spacing[4] },
  card: {
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.radii.xl,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    overflow: 'hidden',
    shadowColor: '#1C1917',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
  banner: {
    height: 68,
    backgroundColor: tokens.colors.primary[600],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing[4],
    overflow: 'hidden',
  },
  bannerCircle: { position: 'absolute', right: -24, top: -34, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.08)' },
  bannerIcon: { width: 42, height: 42, borderRadius: tokens.radii.full, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: tokens.radii.full, paddingHorizontal: tokens.spacing[3], paddingVertical: 5 },
  statusPillOff: { backgroundColor: 'rgba(0,0,0,0.2)' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { ...tokens.typography.bodySm, fontWeight: '700', color: '#FFFFFF', fontSize: 11 },
  body: { padding: tokens.spacing[4] },
  name: { ...tokens.typography.headingLg, color: tokens.colors.field.text },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: tokens.spacing[1] },
  loc: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2], marginTop: tokens.spacing[3] },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: tokens.colors.primary[50], borderRadius: tokens.radii.full, paddingHorizontal: tokens.spacing[3], paddingVertical: 5 },
  chipText: { ...tokens.typography.bodySm, fontWeight: '600', color: tokens.colors.primary[700] },
  divider: { height: 1, backgroundColor: tokens.colors.neutral[100], marginTop: tokens.spacing[4] },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: tokens.spacing[3] },
  manage: { ...tokens.typography.button, fontSize: 15, color: tokens.colors.primary[600] },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: tokens.spacing[8], gap: tokens.spacing[3] },
  emptyDisc: { width: 72, height: 72, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.primary[50], alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...tokens.typography.headingLg, color: tokens.colors.field.text },
  emptyText: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center' },
});
