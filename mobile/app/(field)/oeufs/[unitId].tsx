/**
 * Layer unit detail (Œufs) — mirrors the broiler lot detail, adapted to laying:
 * header, a 2×2 KPI grid (effectif · âge · taux de ponte · œufs du jour),
 * tabs, and a FAB to the egg-collection entry. Data ported from the web
 * (eggProductionApi + productionUnits) — nothing recomputed.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft, ClipboardList, Droplets, Egg, HeartCrack, Plus, Wheat } from 'lucide-react-native';
import { tokens } from '@/theme';
import { HealthSection } from '@/components/health/HealthSection';
import { CloseDayButton } from '@/components/layer/CloseDayButton';
import { LayingRateCurve } from '@/components/charts/LayingRateCurve';
import { Production7dChart } from '@/components/charts/Production7dChart';
import { GradesDonut } from '@/components/charts/GradesDonut';
import { FlockCountCurve } from '@/components/charts/FlockCountCurve';
import { useGetUnitEventsQuery, useListProductionUnitsQuery } from '@/store/api/productionUnitsApi';
import { useGetCollectionsQuery, useGetDailyProductionsQuery, useGetRollingRateQuery, useGetTrayStockQuery } from '@/store/api/eggProductionApi';
import { useGetDailyRecordsQuery } from '@/store/api/poultryBatchesApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useFarmAccess } from '@/auth/useSession';
import { formatNumber } from '@/lib/format';
import { summarizeAttrition } from '@/lib/flock';
import type { EggCollection, PoultryDailyRecord } from '@/types';

const MS_PER_DAY = 86_400_000;
function ageInDays(startDate?: string): number {
  if (!startDate) return 0;
  const t = Date.parse(startDate);
  return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((Date.now() - t) / MS_PER_DAY));
}
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Tab = 'overview' | 'collections' | 'records' | 'layers' | 'sanitaire';
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'overview', label: "Vue d'ensemble" },
  { key: 'collections', label: 'Collectes' },
  { key: 'records', label: 'Journalier' },
  { key: 'layers', label: 'Pondeuses' },
  { key: 'sanitaire', label: 'Sanitaire' },
];

export default function LayerDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ unitId: string }>();
  const raw = Array.isArray(params.unitId) ? params.unitId[0] : params.unitId;
  const unitId = raw ? Number(raw) : NaN;
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { can } = useFarmAccess();
  const canWrite = can('poultry:write');
  const [tab, setTab] = useState<Tab>('overview');

  const skip = selectedFarmId === null || Number.isNaN(unitId);
  const farmId = selectedFarmId as number;
  const { data: units } = useListProductionUnitsQuery(skip ? skipToken : farmId);
  const { data: rate } = useGetRollingRateQuery(skip ? skipToken : { farmId, unitId, days: 7 });
  const { data: collections } = useGetCollectionsQuery(skip ? skipToken : { farmId, unitId });
  const { data: trayStock } = useGetTrayStockQuery(skip ? skipToken : { farmId });
  const { data: records } = useGetDailyRecordsQuery(skip ? skipToken : { farmId, batchId: unitId });
  const { data: events } = useGetUnitEventsQuery(skip ? skipToken : { farmId, unitId });
  const { data: productions } = useGetDailyProductionsQuery(skip ? skipToken : { farmId, unitId });

  const attrition = useMemo(() => summarizeAttrition(events ?? []), [events]);
  const todayGrades = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of (collections ?? []).filter((c) => c.collectionDate === todayIso())) {
      for (const [k, v] of Object.entries(c.gradesCount ?? {})) out[k] = (out[k] ?? 0) + v;
    }
    return out;
  }, [collections]);
  const sortedRecords = useMemo(
    () => [...(records ?? [])].sort((a, b) => b.recordDate.localeCompare(a.recordDate)),
    [records],
  );

  const unit = units?.find((u) => u.id === unitId);
  const age = ageInDays(unit?.startDate);
  const today = todayIso();
  const eggsToday = useMemo(
    () => (collections ?? []).filter((c) => c.collectionDate === today).reduce((s, c) => s + c.totalEggs, 0),
    [collections, today],
  );

  if (selectedFarmId === null) return <Redirect href="/(field)" />;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retour">
          <ArrowLeft size={24} color={tokens.colors.field.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{unit?.name ?? 'Lot de ponte'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.kpiGrid}>
          <Kpi label="Effectif" value={unit ? formatNumber(unit.currentCount) : '—'} unit="pondeuses" />
          <Kpi label="Âge" value={String(age)} unit="jours" />
          <Kpi label="Taux de ponte" value={rate?.avgLayingRatePct != null ? `${rate.avgLayingRatePct.toFixed(1)}%` : '—'} unit="7 j" tone={tokens.colors.primary[600]} />
          <Kpi label="Œufs du jour" value={formatNumber(eggsToday)} unit="œufs" tone={tokens.colors.accent[600]} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsContent}>
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <Pressable key={t.key} style={styles.tab} onPress={() => setTab(t.key)} accessibilityRole="button">
                <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>{t.label}</Text>
                {on && <View style={styles.tabUnderline} />}
              </Pressable>
            );
          })}
        </ScrollView>

        {tab === 'overview' && (
          <View style={styles.tabBlock}>
            <CloseDayButton farmId={farmId} unitId={unitId} />

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Courbe de taux de ponte</Text>
              <Text style={styles.cardHint}>Taux réel par journée clôturée vs cible de pic (90 %).</Text>
              <LayingRateCurve productions={productions ?? []} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Collectes (7 jours)</Text>
              <Production7dChart productions={productions ?? []} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Répartition par calibre (aujourd&apos;hui)</Text>
              <GradesDonut gradesCount={todayGrades} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Stock de plateaux</Text>
              <View style={styles.trayRow}>
                <View style={styles.tray}>
                  <Text style={styles.trayVal}>{formatNumber(trayStock?.fullTraysCount ?? 0)}</Text>
                  <Text style={styles.trayLabel}>Plateaux pleins</Text>
                </View>
                <View style={styles.trayDivider} />
                <View style={styles.tray}>
                  <Text style={styles.trayVal}>{formatNumber(trayStock?.emptyTraysCount ?? 0)}</Text>
                  <Text style={styles.trayLabel}>Plateaux vides</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {tab === 'collections' && (
          <View style={styles.tabBlock}>
            {canWrite && (
              <Pressable style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]} onPress={() => router.push(`/(field)/lots/${unitId}/oeufs`)} accessibilityRole="button" accessibilityLabel="Nouvelle collecte">
                <Egg size={18} color={tokens.colors.primary[700]} />
                <Text style={styles.actionBtnText}>Nouvelle collecte</Text>
              </Pressable>
            )}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Collectes récentes</Text>
            {!collections || collections.length === 0 ? (
              <Text style={styles.muted}>Aucune collecte enregistrée.</Text>
            ) : (
              collections.slice().reverse().slice(0, 20).map((c: EggCollection, i) => (
                <View key={c.id} style={[styles.recRow, i > 0 && styles.recBorder]}>
                  <View style={styles.recDisc}><Egg size={16} color={tokens.colors.accent[400]} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recTitle}>{c.collectionDate} · {c.timeslotKey}</Text>
                    <Text style={styles.recSub}>{formatNumber(c.totalEggs)} œufs · {c.brokenEggs} cassés</Text>
                  </View>
                </View>
              ))
            )}
          </View>
          </View>
        )}

        {tab === 'records' && (
          <View style={styles.tabBlock}>
            {canWrite && (
              <Pressable style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]} onPress={() => router.push(`/(field)/lots/${unitId}/journalier`)} accessibilityRole="button" accessibilityLabel="Nouvelle saisie journalière">
                <ClipboardList size={18} color={tokens.colors.primary[700]} />
                <Text style={styles.actionBtnText}>Nouvelle saisie journalière</Text>
              </Pressable>
            )}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Suivi journalier</Text>
              <Text style={styles.cardHint}>Aliment et eau distribués (la mortalité est dans l&apos;onglet Pondeuses).</Text>
              {sortedRecords.length === 0 ? (
                <Text style={styles.muted}>Aucune saisie pour le moment.</Text>
              ) : (
                sortedRecords.slice(0, 20).map((r: PoultryDailyRecord, i) => (
                  <View key={r.id} style={[styles.recRow, i > 0 && styles.recBorder]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recTitle}>{r.recordDate}</Text>
                      {r.observations ? <Text style={styles.recSub} numberOfLines={1}>{r.observations}</Text> : null}
                    </View>
                    <View style={styles.recMetric}><Wheat size={13} color={tokens.colors.primary[600]} /><Text style={styles.recMetricVal}>{r.feedKg ?? '—'} kg</Text></View>
                    <View style={styles.recMetric}><Droplets size={13} color={tokens.colors.info} /><Text style={styles.recMetricVal}>{r.waterL ?? '—'} L</Text></View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {tab === 'layers' && (
          <View style={styles.tabBlock}>
            {canWrite && (
              <Pressable style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]} onPress={() => router.push(`/(field)/lots/${unitId}/mortalite`)} accessibilityRole="button" accessibilityLabel="Enregistrer une mortalité">
                <HeartCrack size={18} color={tokens.colors.primary[700]} />
                <Text style={styles.actionBtnText}>Enregistrer une mortalité</Text>
              </Pressable>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Effectif de la bande</Text>
              <FlockCountCurve events={events ?? []} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Attrition de la bande</Text>
              <AttritionRow label="Initial" value={formatNumber(attrition.initial)} />
              <AttritionRow label="− Mortalité" value={formatNumber(attrition.mortality)} tone={tokens.colors.error} />
              <AttritionRow label="− Réforme" value={formatNumber(attrition.reform)} tone={tokens.colors.warning} />
              <View style={styles.attritionDivider} />
              <AttritionRow label="= Effectif" value={unit ? formatNumber(unit.currentCount) : '—'} strong />
              <AttritionRow label="Attrition" value={`${attrition.attritionPct.toFixed(1)} %`} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Stock de plateaux</Text>
              <View style={styles.trayRow}>
                <View style={styles.tray}>
                  <Text style={styles.trayVal}>{formatNumber(trayStock?.fullTraysCount ?? 0)}</Text>
                  <Text style={styles.trayLabel}>Plateaux pleins</Text>
                </View>
                <View style={styles.trayDivider} />
                <View style={styles.tray}>
                  <Text style={styles.trayVal}>{formatNumber(trayStock?.emptyTraysCount ?? 0)}</Text>
                  <Text style={styles.trayLabel}>Plateaux vides</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Événements de la bande</Text>
              {!events || events.length === 0 ? (
                <Text style={styles.muted}>Aucun événement.</Text>
              ) : (
                [...events].reverse().slice(0, 20).map((e, i) => (
                  <View key={e.id} style={[styles.recRow, i > 0 && styles.recBorder]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recTitle}>{EVENT_LABELS[e.eventType] ?? e.eventType}{e.reason ? ` · ${e.reason}` : ''}</Text>
                      <Text style={styles.recSub}>{e.occurredAt.slice(0, 10)}</Text>
                    </View>
                    <Text style={[styles.eventDelta, e.quantityDelta < 0 && { color: tokens.colors.error }]}>
                      {e.quantityDelta > 0 ? `+${formatNumber(e.quantityDelta)}` : formatNumber(e.quantityDelta)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {tab === 'sanitaire' && (
          <View style={styles.tabBlock}>
            <HealthSection farmId={farmId} unitId={unitId} />
          </View>
        )}
      </ScrollView>

      {canWrite && (
        <Pressable style={styles.fab} onPress={() => router.push(`/(field)/lots/${unitId}/oeufs`)} accessibilityRole="button" accessibilityLabel="Nouvelle collecte">
          <Plus size={30} color={tokens.colors.earth} />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const EVENT_LABELS: Record<string, string> = {
  CREATED: 'Création de la bande',
  MORTALITY: 'Mortalité',
  REFORM: 'Réforme',
  COUNT_ADJUSTMENT: 'Ajustement d’effectif',
  SALE: 'Vente',
  SALE_CANCEL: 'Annulation de vente',
};

function AttritionRow({ label, value, tone, strong }: { label: string; value: string; tone?: string; strong?: boolean }) {
  return (
    <View style={styles.attritionRow}>
      <Text style={[styles.attritionLabel, tone && { color: tone }]}>{label}</Text>
      <Text style={[styles.attritionVal, tone && { color: tone }, strong && styles.attritionValStrong]}>{value}</Text>
    </View>
  );
}

function Kpi({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label.toUpperCase()}</Text>
      <View style={styles.kpiValRow}>
        <Text style={[styles.kpiVal, tone && { color: tone }]} numberOfLines={1}>{value}</Text>
        {unit ? <Text style={styles.kpiUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: tokens.layout.screenPadding, paddingVertical: tokens.spacing[3] },
  headerTitle: { ...tokens.typography.headingLg, color: tokens.colors.field.text, flex: 1, textAlign: 'center' },
  content: { paddingHorizontal: tokens.layout.screenPadding, paddingBottom: tokens.spacing[16] },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[3] },
  kpi: { width: '47%', flexGrow: 1, backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200], borderRadius: tokens.radii.lg, padding: tokens.spacing[4] },
  kpiLabel: { ...tokens.typography.bodySm, fontSize: 10.5, letterSpacing: 0.4, fontWeight: '700', color: tokens.colors.field.textMuted },
  kpiValRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: tokens.spacing[2] },
  kpiVal: { ...tokens.typography.numericSm, fontSize: 24, color: tokens.colors.field.text },
  kpiUnit: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  tabs: { marginTop: tokens.spacing[5], borderBottomWidth: 1, borderBottomColor: tokens.colors.neutral[200] },
  tabsContent: { gap: tokens.spacing[5] },
  tab: { alignItems: 'center', paddingBottom: tokens.spacing[2] },
  tabText: { ...tokens.typography.bodySm, fontWeight: '600', color: tokens.colors.field.textMuted },
  tabTextOn: { color: tokens.colors.primary[700] },
  tabUnderline: { position: 'absolute', bottom: -1, height: 2.5, width: '70%', backgroundColor: tokens.colors.primary[600], borderRadius: 2 },
  tabBlock: { marginTop: tokens.spacing[4], gap: tokens.spacing[3] },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: tokens.spacing[2], minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, borderWidth: tokens.layout.borderWidth, borderColor: tokens.colors.primary[600], backgroundColor: tokens.colors.primary[50] },
  actionBtnText: { ...tokens.typography.button, fontSize: 15, color: tokens.colors.primary[700] },
  card: { backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200], borderRadius: tokens.radii.xl, padding: tokens.spacing[4], marginTop: tokens.spacing[4] },
  cardTitle: { ...tokens.typography.headingMd, color: tokens.colors.field.text, marginBottom: tokens.spacing[2] },
  cardHint: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginBottom: tokens.spacing[2] },
  attritionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingVertical: tokens.spacing[1] },
  attritionLabel: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
  attritionVal: { ...tokens.typography.numericSm, fontSize: 15, color: tokens.colors.field.text },
  attritionValStrong: { fontSize: 18 },
  attritionDivider: { height: 1, backgroundColor: tokens.colors.neutral[200], marginVertical: tokens.spacing[2] },
  recMetric: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: tokens.spacing[2] },
  recMetricVal: { ...tokens.typography.numericSm, fontSize: 12, color: tokens.colors.field.text },
  eventDelta: { ...tokens.typography.numericSm, fontSize: 14, color: tokens.colors.success },
  trayRow: { flexDirection: 'row', alignItems: 'center' },
  tray: { flex: 1, alignItems: 'center' },
  trayVal: { ...tokens.typography.numericSm, fontSize: 26, color: tokens.colors.field.text },
  trayLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },
  trayDivider: { width: 1, height: 40, backgroundColor: tokens.colors.neutral[100] },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[4] },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], paddingVertical: tokens.spacing[3] },
  recBorder: { borderTopWidth: 1, borderTopColor: tokens.colors.neutral[100] },
  recDisc: { width: 34, height: 34, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.accent[50], alignItems: 'center', justifyContent: 'center' },
  recTitle: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  recSub: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  fab: { position: 'absolute', right: tokens.spacing[5], bottom: tokens.spacing[6], width: 60, height: 60, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.accent[400], alignItems: 'center', justifyContent: 'center', shadowColor: '#1C1917', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
});
