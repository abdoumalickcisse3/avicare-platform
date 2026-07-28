/**
 * Lot detail — broiler batch, rebuilt to the Stitch "Détail du Lot - AviCare
 * Mobile" reference: header, a 2×2 KPI grid (effectif · âge · mortalité ·
 * poids moyen), swipeable tabs (Vue d'ensemble / Saisies / Sanitaire /
 * Documents) and a FAB. Data is ported from the web (poultryBatchesApi):
 * batch, performance, weighings, daily records — nothing recomputed.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft, ClipboardList, Plus, Scale } from 'lucide-react-native';
import { tokens } from '@/theme';
import { GrowthChart, type GrowthPoint } from '@/components/charts/GrowthChart';
import { MortalityChart } from '@/components/charts/MortalityChart';
import { FeedConsumptionChart } from '@/components/charts/FeedConsumptionChart';
import { HealthSection } from '@/components/health/HealthSection';
import { MicButton } from '@/components/assistant/MicButton';
import { AssistantSheet } from '@/components/assistant/AssistantSheet';
import { scoreMeta, daysUntil } from '@/lib/poultry';
import {
  useGetBatchQuery,
  useGetDailyRecordsQuery,
  useGetPerformanceQuery,
  useGetWeighingsQuery,
} from '@/store/api/poultryBatchesApi';
import { useListBreedsQuery } from '@/store/api/breedsApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useFarmAccess } from '@/auth/useSession';
import { formatNumber } from '@/lib/format';
import type { PoultryDailyRecord, WeighingSample } from '@/types';

const MS_PER_DAY = 86_400_000;
function ageInDays(startDate?: string): number {
  if (!startDate) return 0;
  const t = Date.parse(startDate);
  return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((Date.now() - t) / MS_PER_DAY));
}
function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.getDate()}/${d.getMonth() + 1}`;
}
const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function formatDateLong(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

type Tab = 'overview' | 'saisies' | 'pesees' | 'sanitaire';
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'overview', label: "Vue d'ensemble" },
  { key: 'saisies', label: 'Saisies' },
  { key: 'pesees', label: 'Pesées' },
  { key: 'sanitaire', label: 'Sanitaire' },
];

export default function LotDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ unitId: string }>();
  const raw = Array.isArray(params.unitId) ? params.unitId[0] : params.unitId;
  const batchId = raw ? Number(raw) : NaN;
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { can } = useFarmAccess();
  const canWrite = can('poultry:write');
  const [tab, setTab] = useState<Tab>('overview');
  const [assistantOpen, setAssistantOpen] = useState(false);

  const skip = selectedFarmId === null || Number.isNaN(batchId);
  const arg = skip ? skipToken : { farmId: selectedFarmId as number, batchId };
  const { data: batch } = useGetBatchQuery(arg);
  const planned = batch?.status === 'PLANNED';
  const { data: perf } = useGetPerformanceQuery(skip || planned ? skipToken : { farmId: selectedFarmId as number, batchId });
  const { data: weighings } = useGetWeighingsQuery(skip || planned ? skipToken : { farmId: selectedFarmId as number, batchId });
  const { data: records } = useGetDailyRecordsQuery(skip ? skipToken : { farmId: selectedFarmId as number, batchId });
  const { data: breeds } = useListBreedsQuery(skip ? skipToken : 'POULTRY');

  const breedName = breeds?.find((b) => b.id === batch?.breedId)?.name;
  const age = ageInDays(batch?.startDate);
  const deaths = batch ? Math.max(0, batch.initialCount - batch.currentCount) : 0;
  const mortalityPct = perf?.cumulativeMortalityPercent ?? (batch && batch.initialCount > 0 ? (deaths / batch.initialCount) * 100 : 0);
  const avgKg = perf?.currentWeightG != null ? perf.currentWeightG / 1000 : weighings && weighings.length ? weighings[weighings.length - 1]!.avgWeightG / 1000 : null;

  const growth = useMemo<GrowthPoint[]>(
    () => (weighings ?? []).slice().sort((a, b) => a.ageDays - b.ageDays).map((w) => ({ age: w.ageDays, weightG: w.avgWeightG })),
    [weighings],
  );
  const target = batch?.targetAgeDays && batch?.targetWeightG ? { age: batch.targetAgeDays, weightG: batch.targetWeightG } : null;

  if (selectedFarmId === null) return <Redirect href="/(field)" />;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retour">
          <ArrowLeft size={24} color={tokens.colors.field.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {batch?.name ?? (batch ? `Lot #${batch.id}` : 'Lot')}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* KPI grid */}
        <View style={styles.kpiGrid}>
          <Kpi label="Effectif actuel" value={batch ? formatNumber(batch.currentCount) : '—'} unit="sujets" />
          <Kpi label="Âge" value={String(age)} unit="jours" />
          <Kpi label="Mortalité" value={`${mortalityPct.toFixed(1)}%`} unit="cumulée" tone={deaths > 0 ? tokens.colors.error : undefined} />
          <Kpi label="Poids moyen" value={avgKg != null ? avgKg.toFixed(2) : '—'} unit="kg" tone={tokens.colors.primary[600]} />
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <Pressable key={t.key} style={styles.tab} onPress={() => setTab(t.key)} accessibilityRole="button">
                <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>{t.label}</Text>
                {on && <View style={styles.tabUnderline} />}
              </Pressable>
            );
          })}
        </View>

        {tab === 'overview' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Croissance du lot</Text>
              <View style={styles.legendRow}>
                <Text style={styles.cardSub}>Poids moyen vs cible</Text>
                <View style={styles.legend}>
                  <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: tokens.colors.primary[600] }]} /><Text style={styles.legendText}>Réel</Text></View>
                  {target && <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: tokens.colors.neutral[400] }]} /><Text style={styles.legendText}>Cible</Text></View>}
                </View>
              </View>
              <GrowthChart data={growth} target={target} />
            </View>

            {/* Maturity forecast (mirrors the web "Prévision" gradient card). */}
            {perf && (
              <View style={styles.forecastCard}>
                <Text style={styles.forecastEyebrow}>PRÉVISION · MATURITÉ ESTIMÉE</Text>
                {perf.forecastedTargetDate ? (
                  <>
                    <Text style={styles.forecastDate}>{formatDateLong(perf.forecastedTargetDate)}</Text>
                    <Text style={styles.forecastSub}>Jours restants : {daysUntil(perf.forecastedTargetDate) ?? '—'}</Text>
                  </>
                ) : (
                  <Text style={styles.forecastSub}>Disponible après la première pesée.</Text>
                )}
                {(() => {
                  const s = scoreMeta(perf.performanceScore);
                  return s ? (
                    <View style={[styles.scoreBadge, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                      <Text style={styles.scoreText}>{s.label}</Text>
                    </View>
                  ) : null;
                })()}
              </View>
            )}

            {perf && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Performance</Text>
                <View style={styles.perfRow}>
                  <Perf label="GMQ" value={perf.gmqGPerDay != null ? `${formatNumber(perf.gmqGPerDay)} g/j` : '—'} />
                  <Perf label="IC (FCR)" value={perf.feedConversionRatio != null ? String(perf.feedConversionRatio) : '—'} />
                  <Perf label="Aliment cumulé" value={perf.cumulativeFeedKg != null ? `${formatNumber(perf.cumulativeFeedKg)} kg` : '—'} />
                </View>
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Mortalité quotidienne</Text>
              <MortalityChart records={records ?? []} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Consommation cumulée</Text>
              <FeedConsumptionChart records={records ?? []} />
            </View>
          </>
        )}

        {tab === 'saisies' && (
          <View style={styles.tabBlock}>
            {canWrite && <ActionButton icon={ClipboardList} label="Nouvelle saisie journalière" onPress={() => router.push(`/(field)/lots/${batchId}/journalier`)} />}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Saisies journalières</Text>
              {!records || records.length === 0 ? (
                <Text style={styles.muted}>Aucune saisie enregistrée.</Text>
              ) : (
                records.slice().reverse().map((r: PoultryDailyRecord, i) => (
                  <View key={r.id} style={[styles.recRow, i > 0 && styles.recBorder]}>
                    <View style={styles.recDisc}><ClipboardList size={16} color={tokens.colors.info} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recTitle}>{shortDate(r.recordDate)}</Text>
                      <Text style={styles.recSub}>{r.mortalityCount} mort · {formatNumber(r.feedKg)} kg aliment · {formatNumber(r.waterL)} L eau</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {tab === 'pesees' && (
          <View style={styles.tabBlock}>
            {canWrite && <ActionButton icon={Scale} label="Nouvelle pesée" onPress={() => router.push(`/(field)/lots/${batchId}/pesee`)} />}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Pesées</Text>
              {!weighings || weighings.length === 0 ? (
                <Text style={styles.muted}>Aucune pesée enregistrée.</Text>
              ) : (
                weighings.slice().reverse().map((w: WeighingSample, i) => (
                  <View key={w.id} style={[styles.weighRow, i > 0 && styles.recBorder]}>
                    <View style={styles.weighHead}>
                      <Text style={styles.recTitle}>{shortDate(w.sampleDate)}</Text>
                      <Text style={styles.recSub}>Jour {w.ageDays} · {w.sampleSize} sujets</Text>
                    </View>
                    <View style={styles.weighMetrics}>
                      <WeighMetric label="Moyenne" value={`${Math.round(w.avgWeightG)} g`} />
                      {w.uniformityPercent != null ? <WeighMetric label="Uniformité" value={`${Math.round(w.uniformityPercent)}%`} /> : null}
                      {w.minWeightG != null && w.maxWeightG != null ? <WeighMetric label="Min–Max" value={`${w.minWeightG}–${w.maxWeightG} g`} /> : null}
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {tab === 'sanitaire' && (
          <View style={styles.tabBlock}>
            <HealthSection farmId={selectedFarmId} unitId={batchId} />
          </View>
        )}
      </ScrollView>

      {/* Assistant vocal (Jawdi) + FAB saisie rapide — gated by poultry:write */}
      {canWrite && <MicButton onPress={() => setAssistantOpen(true)} style={styles.micFab} />}
      {canWrite && (
        <Pressable style={styles.fab} onPress={() => router.push(`/(field)/lots/${batchId}/mortalite`)} accessibilityRole="button" accessibilityLabel="Nouvelle saisie">
          <Plus size={30} color={tokens.colors.earth} />
        </Pressable>
      )}

      <AssistantSheet visible={assistantOpen} onClose={() => setAssistantOpen(false)} unitId={batchId} />
    </SafeAreaView>
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

function Perf({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.perf}>
      <Text style={styles.perfVal}>{value}</Text>
      <Text style={styles.perfLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({ icon: Icon, label, onPress }: { icon: typeof Scale; label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Icon size={18} color={tokens.colors.primary[700]} />
      <Text style={styles.actionBtnText}>{label}</Text>
    </Pressable>
  );
}

function WeighMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.weighMetric}>
      <Text style={styles.weighMetricVal}>{value}</Text>
      <Text style={styles.weighMetricLabel}>{label}</Text>
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
  tabs: { flexDirection: 'row', marginTop: tokens.spacing[5], borderBottomWidth: 1, borderBottomColor: tokens.colors.neutral[200] },
  tab: { flex: 1, alignItems: 'center', paddingBottom: tokens.spacing[2] },
  tabText: { ...tokens.typography.bodySm, fontWeight: '600', color: tokens.colors.field.textMuted },
  tabTextOn: { color: tokens.colors.primary[700] },
  tabUnderline: { position: 'absolute', bottom: -1, height: 2.5, width: '70%', backgroundColor: tokens.colors.primary[600], borderRadius: 2 },
  card: { backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200], borderRadius: tokens.radii.xl, padding: tokens.spacing[4], marginTop: tokens.spacing[4] },
  cardTitle: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  cardSub: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, marginBottom: tokens.spacing[2] },
  legend: { flexDirection: 'row', gap: tokens.spacing[3] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  perfRow: { flexDirection: 'row', gap: tokens.spacing[3], marginTop: tokens.spacing[3] },
  perf: { flex: 1, backgroundColor: tokens.colors.neutral[50], borderRadius: tokens.radii.md, padding: tokens.spacing[3] },
  perfVal: { ...tokens.typography.numericSm, fontSize: 16, color: tokens.colors.field.text },
  perfLabel: { ...tokens.typography.bodySm, fontSize: 11, color: tokens.colors.field.textMuted, marginTop: 2 },
  forecastCard: { backgroundColor: tokens.colors.primary[700], borderRadius: tokens.radii.xl, padding: tokens.spacing[5], marginTop: tokens.spacing[4] },
  forecastEyebrow: { ...tokens.typography.bodySm, fontSize: 10.5, letterSpacing: 0.6, fontWeight: '700', color: 'rgba(255,255,255,0.75)' },
  forecastDate: { ...tokens.typography.numericSm, fontSize: 26, color: tokens.colors.neutral[0], marginTop: tokens.spacing[2] },
  forecastSub: { ...tokens.typography.bodyMd, color: 'rgba(255,255,255,0.9)', marginTop: tokens.spacing[1] },
  scoreBadge: { alignSelf: 'flex-start', marginTop: tokens.spacing[3], borderRadius: tokens.radii.full, paddingHorizontal: tokens.spacing[3], paddingVertical: tokens.spacing[1] },
  scoreText: { ...tokens.typography.bodySm, fontWeight: '700', color: tokens.colors.neutral[0] },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[4] },
  tabBlock: { marginTop: tokens.spacing[4], gap: tokens.spacing[3] },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: tokens.spacing[2], minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, borderWidth: tokens.layout.borderWidth, borderColor: tokens.colors.primary[600], backgroundColor: tokens.colors.primary[50] },
  actionBtnText: { ...tokens.typography.button, fontSize: 15, color: tokens.colors.primary[700] },
  weighRow: { paddingVertical: tokens.spacing[3], gap: tokens.spacing[2] },
  weighHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  weighMetrics: { flexDirection: 'row', gap: tokens.spacing[3] },
  weighMetric: { backgroundColor: tokens.colors.neutral[50], borderRadius: tokens.radii.md, paddingHorizontal: tokens.spacing[3], paddingVertical: tokens.spacing[2] },
  weighMetricVal: { ...tokens.typography.numericSm, fontSize: 15, color: tokens.colors.field.text },
  weighMetricLabel: { ...tokens.typography.bodySm, fontSize: 11, color: tokens.colors.field.textMuted },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], paddingVertical: tokens.spacing[3] },
  recBorder: { borderTopWidth: 1, borderTopColor: tokens.colors.neutral[100] },
  recDisc: { width: 34, height: 34, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.infoLight, alignItems: 'center', justifyContent: 'center' },
  recTitle: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  recSub: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  fab: { position: 'absolute', right: tokens.spacing[5], bottom: tokens.spacing[6], width: 60, height: 60, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.accent[400], alignItems: 'center', justifyContent: 'center', shadowColor: '#1C1917', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  micFab: { position: 'absolute', right: tokens.spacing[5], bottom: tokens.spacing[6] + 72 },
});
