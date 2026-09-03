/**
 * Élevage › Poulets de chair — the broiler batch list, ported from the web
 * `/elevage/lots` page (same data via `poultryBatchesApi`) and styled to the
 * mobile design system: status filter chips, a search box, and rich batch
 * cards (breed, age progress, headcount, mortality, status). Tapping a card
 * opens the existing lot-detail / entry screens.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { Bird, ChevronRight, ClipboardCheck, Search } from 'lucide-react-native';
import { tokens } from '@/theme';
import { AppHeader } from '@/components/AppHeader';
import { useGetBatchesQuery } from '@/store/api/poultryBatchesApi';
import { useListBreedsQuery } from '@/store/api/breedsApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { formatNumber } from '@/lib/format';
import type { BatchStatus, PoultryBatch } from '@/types';

const MS_PER_DAY = 86_400_000;
function ageInDays(startDate: string): number {
  const t = Date.parse(startDate);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / MS_PER_DAY));
}

const STATUS_STYLE: Record<BatchStatus, { label: string; bg: string; fg: string }> = {
  ACTIVE: { label: 'Actif', bg: tokens.colors.successLight, fg: tokens.colors.successDark },
  PLANNED: { label: 'Planifié', bg: tokens.colors.infoLight, fg: tokens.colors.infoDark },
  CLOSED: { label: 'Clôturé', bg: tokens.colors.neutral[100], fg: tokens.colors.neutral[600] },
  CANCELLED: { label: 'Annulé', bg: tokens.colors.errorLight, fg: tokens.colors.errorDark },
};

const FILTERS: Array<{ key: 'all' | BatchStatus; label: string }> = [
  { key: 'all', label: 'Tous' },
  { key: 'ACTIVE', label: 'Actifs' },
  { key: 'PLANNED', label: 'Planifiés' },
  { key: 'CLOSED', label: 'Clôturés' },
];

export default function ElevageScreen() {
  const router = useRouter();
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const [filter, setFilter] = useState<'all' | BatchStatus>('all');
  const [q, setQ] = useState('');

  const { data: batches, isLoading } = useGetBatchesQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId, status: filter === 'all' ? undefined : filter },
  );
  const { data: breeds } = useListBreedsQuery(selectedFarmId === null ? skipToken : 'POULTRY');

  const breedName = useMemo(() => {
    const m = new Map<number, string>();
    (breeds ?? []).forEach((b) => m.set(b.id, b.name));
    return m;
  }, [breeds]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (batches ?? []).filter((b) => !needle || (b.name ?? `lot #${b.id}`).toLowerCase().includes(needle));
  }, [batches, q]);

  if (selectedFarmId === null) return <Redirect href="/(field)" />;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Poulets de chair</Text>
        <Text style={styles.subtitle}>Suivez vos lots, leur croissance et leur santé.</Text>

        {/* Search */}
        <View style={styles.searchBox}>
          <Search size={18} color={tokens.colors.field.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un lot…"
            placeholderTextColor={tokens.colors.field.disabled}
            value={q}
            onChangeText={setQ}
          />
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <Pressable key={f.key} style={[styles.filterChip, on && styles.filterChipOn]} onPress={() => setFilter(f.key)} accessibilityRole="button">
                <Text style={[styles.filterText, on && styles.filterTextOn]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Comparing finished cycles is a different question from browsing live ones, so it
            gets its own screen — offered where the reader is already looking at closed lots. */}
        {filter === 'CLOSED' && (
          <Pressable
            onPress={() => router.push('/(field)/bilans')}
            accessibilityRole="button"
            accessibilityLabel="Comparer les bilans de bande"
            style={({ pressed }) => [styles.compareBtn, pressed && { opacity: 0.85 }]}
          >
            <ClipboardCheck size={18} color={tokens.colors.primary[700]} />
            <Text style={styles.compareText}>Comparer les bilans</Text>
          </Pressable>
        )}

        {isLoading ? (
          <Text style={styles.muted}>Chargement…</Text>
        ) : rows.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyDisc}><Bird size={28} color={tokens.colors.primary[600]} /></View>
            <Text style={styles.emptyText}>Aucun lot pour ce filtre.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {rows.map((b: PoultryBatch) => {
              const st = STATUS_STYLE[b.status];
              const age = ageInDays(b.startDate);
              const target = b.targetAgeDays ?? null;
              const progress = target ? Math.max(0, Math.min(1, age / target)) : 0;
              const deaths = b.deaths;
              return (
                <Pressable
                  key={b.id}
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                  onPress={() => router.push(`/(field)/lots/${b.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={b.name ?? `Lot #${b.id}`}
                >
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name} numberOfLines={1}>{b.name ?? `Lot #${b.id}`}</Text>
                      <Text style={styles.breed}>{breedName.get(b.breedId) ?? 'Race —'}</Text>
                    </View>
                    <View style={[styles.statusChip, { backgroundColor: st.bg }]}>
                      <Text style={[styles.statusText, { color: st.fg }]}>{st.label}</Text>
                    </View>
                  </View>

                  {/* Age progress */}
                  <View style={styles.progressRow}>
                    <Text style={styles.progressLabel}>Âge</Text>
                    <Text style={styles.progressVal}>Jour {age}{target ? ` / ${target}` : ''}</Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
                  </View>

                  {/* Stats */}
                  <View style={styles.stats}>
                    <View style={styles.stat}>
                      <Text style={styles.statValue}>{formatNumber(b.currentCount)}</Text>
                      <Text style={styles.statLabel}>Effectif</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.stat}>
                      <Text style={[styles.statValue, deaths > 0 && { color: tokens.colors.error }]}>{formatNumber(deaths)}</Text>
                      <Text style={styles.statLabel}>Mortalité</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.stat}>
                      <Text style={styles.statValue}>{formatNumber(b.initialCount)}</Text>
                      <Text style={styles.statLabel}>Départ</Text>
                    </View>
                    <ChevronRight size={20} color={tokens.colors.neutral[400]} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[2],
    minHeight: tokens.touch.cta,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.primary[200],
    backgroundColor: tokens.colors.primary[50],
    marginBottom: tokens.spacing[3],
  },
  compareText: { ...tokens.typography.button, color: tokens.colors.primary[700] },
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[16] },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[1], marginBottom: tokens.spacing[4] },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200], borderRadius: tokens.radii.lg, paddingHorizontal: tokens.spacing[3], minHeight: 46 },
  searchInput: { flex: 1, ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  filters: { gap: tokens.spacing[2], paddingVertical: tokens.spacing[3] },
  filterChip: { paddingHorizontal: tokens.spacing[4], paddingVertical: tokens.spacing[2], borderRadius: tokens.radii.full, backgroundColor: tokens.colors.neutral[100] },
  filterChipOn: { backgroundColor: tokens.colors.primary[600] },
  filterText: { ...tokens.typography.bodySm, fontWeight: '600', color: tokens.colors.field.textMuted },
  filterTextOn: { color: tokens.colors.neutral[0] },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[8] },
  list: { gap: tokens.spacing[3] },
  card: {
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.radii.xl,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    padding: tokens.spacing[4],
    shadowColor: '#1C1917',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardPressed: { opacity: 0.92 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spacing[2] },
  name: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  breed: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 1 },
  statusChip: { borderRadius: tokens.radii.full, paddingHorizontal: tokens.spacing[3], paddingVertical: 4 },
  statusText: { ...tokens.typography.bodySm, fontWeight: '700', fontSize: 11 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: tokens.spacing[3] },
  progressLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  progressVal: { ...tokens.typography.bodySm, fontWeight: '600', color: tokens.colors.field.text },
  track: { height: 8, backgroundColor: tokens.colors.neutral[100], borderRadius: 4, overflow: 'hidden', marginTop: tokens.spacing[1] },
  fill: { height: '100%', backgroundColor: tokens.colors.primary[500], borderRadius: 4 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], marginTop: tokens.spacing[4] },
  stat: { alignItems: 'flex-start' },
  statValue: { ...tokens.typography.numericSm, fontSize: 18, color: tokens.colors.field.text },
  statLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  statDivider: { width: 1, height: 28, backgroundColor: tokens.colors.neutral[100] },
  emptyBox: { alignItems: 'center', paddingVertical: tokens.spacing[10], gap: tokens.spacing[3] },
  emptyDisc: { width: 64, height: 64, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.primary[50], alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
});
