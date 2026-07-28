/**
 * Suivi sanitaire — the farm-level health overview, ported from the web
 * `/elevage/sanitaire` (`HealthOverviewView`): four alert KPI tiles, a recent
 * health-events timeline built from the consolidated `alerts` payload
 * (compute-on-read, no events table in V1), and two summary cards (vaccination
 * programs + medical library). Read-only — recording events happens on the
 * per-lot Sanitaire tab / the web. Reached from the Élevage drawer group and
 * gated by `health:read` + the backend `module.health` (403 → lock card).
 */
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import {
  BookOpen,
  CalendarClock,
  CalendarRange,
  Eye,
  HeartPulse,
  Lock,
  Pill,
  Stethoscope,
  Syringe,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { tokens } from '@/theme';
import { AppHeader } from '@/components/AppHeader';
import {
  useGetHealthAlertsQuery,
  useGetProgramsQuery,
  useGetTreatmentCatalogQuery,
  useGetVaccinesQuery,
} from '@/store/api/healthApi';
import { useListProductionUnitsQuery } from '@/store/api/productionUnitsApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { humanizeKey } from '@/lib/health';
import { formatNumber } from '@/lib/format';
import type { HealthAlerts } from '@/types';

type EventKind = 'vaccination' | 'treatment' | 'observation' | 'vet-visit';

interface TimelineEvent {
  kind: EventKind;
  title: string;
  subtitle: string;
  date: string;
  color: string;
  icon: LucideIcon;
}

const KIND_META: Record<EventKind, { label: string; color: string }> = {
  vaccination: { label: 'Vaccins', color: tokens.colors.error },
  treatment: { label: 'Traitements', color: tokens.colors.info },
  observation: { label: 'Observations', color: tokens.colors.warning },
  'vet-visit': { label: 'Visites', color: tokens.colors.vet },
};

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function buildEvents(alerts: HealthAlerts | undefined, unitName: (id: number) => string): TimelineEvent[] {
  if (!alerts) return [];
  const out: TimelineEvent[] = [];
  for (const v of alerts.vaccinationsLate) {
    out.push({
      kind: 'vaccination',
      title: `Vaccin ${humanizeKey(v.vaccineKey)} en retard`,
      subtitle: `${unitName(v.unitId)} · ${v.daysLate} j de retard`,
      date: v.dueDate,
      color: tokens.colors.error,
      icon: Syringe,
    });
  }
  for (const o of alerts.criticalObservations) {
    out.push({
      kind: 'observation',
      title: o.title,
      subtitle: `${unitName(o.unitId)} · ${o.severity === 'CRITICAL' ? 'Critique' : 'Vigilance'}`,
      date: o.observationDate,
      color: tokens.colors.warning,
      icon: Eye,
    });
  }
  for (const w of alerts.activeWithdrawals) {
    out.push({
      kind: 'treatment',
      title: `Délai d'attente · ${humanizeKey(w.treatmentKey)}`,
      subtitle: `${unitName(w.unitId)} · viande J-${w.daysRemainingMeat ?? '?'} / œufs J-${w.daysRemainingEggs ?? '?'}`,
      date: w.withdrawalEndDateMeat ?? w.withdrawalEndDateEggs ?? '',
      color: tokens.colors.info,
      icon: Pill,
    });
  }
  for (const f of alerts.upcomingFollowUps) {
    out.push({
      kind: 'vet-visit',
      title: 'Visite vétérinaire de suivi',
      subtitle: `${unitName(f.unitId)} · dans ${f.daysUntil} j`,
      date: f.followUpDate,
      color: tokens.colors.vet,
      icon: Stethoscope,
    });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export default function SanitaireScreen() {
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const [filter, setFilter] = useState<EventKind | 'all'>('all');

  const arg = selectedFarmId === null ? skipToken : { farmId: selectedFarmId };
  const { data: alerts, isLoading, error } = useGetHealthAlertsQuery(arg);
  const { data: units } = useListProductionUnitsQuery(selectedFarmId ?? skipToken);
  const { data: vaccines } = useGetVaccinesQuery(arg);
  const { data: programs } = useGetProgramsQuery(arg);
  const { data: treatments } = useGetTreatmentCatalogQuery(arg);

  const unitName = useMemo(() => {
    const map = new Map((units ?? []).map((u) => [u.id, u.name || `Lot #${u.id}`]));
    return (id: number) => map.get(id) ?? `Lot #${id}`;
  }, [units]);

  const events = useMemo(() => buildEvents(alerts, unitName), [alerts, unitName]);
  const shown = filter === 'all' ? events : events.filter((e) => e.kind === filter);

  if (selectedFarmId === null) return <Redirect href="/(field)" />;

  const moduleInactive = (error as { status?: number } | undefined)?.status === 403;

  // KPI derivations (mirror HealthOverviewKpis).
  const lateCount = alerts?.vaccinationsLate.length ?? 0;
  const withdrawalCount = alerts?.activeWithdrawals.length ?? 0;
  const nextFollowUp = alerts?.upcomingFollowUps[0];
  const minWithdrawalDays = (() => {
    const days = (alerts?.activeWithdrawals ?? [])
      .flatMap((w) => [w.daysRemainingMeat, w.daysRemainingEggs])
      .filter((d): d is number => d != null && d >= 0);
    return days.length ? Math.min(...days) : null;
  })();

  const tiles = [
    { label: 'Vaccins en attente', value: String(lateCount), hint: lateCount > 0 ? 'Doses en retard' : 'À jour', icon: Syringe, color: lateCount > 0 ? tokens.colors.error : tokens.colors.success },
    { label: 'Traitements actifs', value: String(withdrawalCount), hint: withdrawalCount > 0 ? 'En cours de délai' : 'Aucun', icon: Pill, color: tokens.colors.info },
    { label: "Délais d'attente", value: minWithdrawalDays != null ? `J-${minWithdrawalDays}` : '—', hint: minWithdrawalDays != null ? 'Avant vente autorisée' : 'Aucun délai', icon: CalendarClock, color: tokens.colors.warning },
    { label: 'Prochaine visite véto', value: nextFollowUp ? `J-${nextFollowUp.daysUntil}` : '—', hint: nextFollowUp ? 'Suivi programmé' : 'Aucun suivi', icon: Stethoscope, color: tokens.colors.vet },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.pageHead}>
          <View style={styles.pageIcon}><HeartPulse size={20} color={tokens.colors.primary[600]} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Suivi sanitaire</Text>
            <Text style={styles.subtitle}>Vaccinations, traitements, observations et visites vétérinaires.</Text>
          </View>
        </View>

        {moduleInactive ? (
          <View style={styles.lockCard}>
            <Lock size={22} color={tokens.colors.neutral[400]} />
            <Text style={styles.lockTitle}>Module sanitaire inactif</Text>
            <Text style={styles.lockText}>Activez le module santé pour suivre vaccinations, traitements et observations.</Text>
          </View>
        ) : (
          <>
            {/* KPI tiles */}
            <View style={styles.kpiGrid}>
              {tiles.map((t) => (
                <View key={t.label} style={[styles.kpiTile, { borderLeftColor: t.color }]}>
                  <View style={styles.kpiTop}>
                    <Text style={styles.kpiLabel}>{t.label}</Text>
                    <View style={[styles.kpiIcon, { backgroundColor: `${t.color}1A` }]}><t.icon size={16} color={t.color} /></View>
                  </View>
                  <Text style={[styles.kpiVal, { color: t.color }]}>{isLoading ? '—' : t.value}</Text>
                  <Text style={styles.kpiHint}>{t.hint}</Text>
                </View>
              ))}
            </View>

            {/* Timeline */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Événements récents</Text>
              <View style={styles.filters}>
                {(['all', 'vaccination', 'treatment', 'observation', 'vet-visit'] as const).map((k) => {
                  const on = filter === k;
                  const label = k === 'all' ? 'Tous' : KIND_META[k].label;
                  return (
                    <Text
                      key={k}
                      onPress={() => setFilter(k)}
                      style={[styles.filterChip, on && styles.filterChipOn]}
                      accessibilityRole="button"
                    >
                      {label}
                    </Text>
                  );
                })}
              </View>

              {isLoading ? (
                <Text style={styles.muted}>Chargement…</Text>
              ) : shown.length === 0 ? (
                <Text style={styles.muted}>Aucun événement à signaler. Tout est à jour.</Text>
              ) : (
                shown.map((e, i) => (
                  <View key={`${e.kind}-${i}`} style={[styles.eventRow, i > 0 && styles.eventBorder]}>
                    <View style={[styles.eventDisc, { backgroundColor: `${e.color}1A` }]}><e.icon size={16} color={e.color} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.eventTitle} numberOfLines={1}>{e.title}</Text>
                      <Text style={styles.eventSub} numberOfLines={1}>{e.subtitle}</Text>
                    </View>
                    <Text style={styles.eventDate}>{fmtDate(e.date)}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Vaccination programs */}
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <CalendarRange size={18} color={tokens.colors.primary[600]} />
                <Text style={styles.cardTitle}>Programmes vaccinaux</Text>
              </View>
              <Text style={styles.body}>
                {formatNumber(programs?.length ?? 0)} programme(s) plateforme · {formatNumber(units?.length ?? 0)} lot(s) suivi(s).
              </Text>
              <Text style={styles.bodyMuted}>
                Assignez un programme depuis l&apos;onglet Sanitaire de chaque lot pour suivre le calendrier vaccinal.
              </Text>
            </View>

            {/* Medical library */}
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <BookOpen size={18} color={tokens.colors.primary[600]} />
                <Text style={styles.cardTitle}>Bibliothèque médicale</Text>
              </View>
              <View style={styles.libRow}>
                <View style={styles.libStat}>
                  <Text style={styles.libLabel}>Vaccins</Text>
                  <Text style={styles.libVal}>{formatNumber(vaccines?.length ?? 0)}</Text>
                </View>
                <View style={styles.libStat}>
                  <Text style={styles.libLabel}>Traitements</Text>
                  <Text style={styles.libVal}>{treatments ? formatNumber(treatments.length) : '—'}</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[16], gap: tokens.spacing[4] },

  pageHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3] },
  pageIcon: { width: 40, height: 40, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.primary[50], alignItems: 'center', justifyContent: 'center' },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },

  lockCard: { alignItems: 'center', gap: tokens.spacing[2], backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200], borderRadius: tokens.radii.xl, padding: tokens.spacing[8] },
  lockTitle: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  lockText: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, textAlign: 'center' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[3] },
  kpiTile: { flexBasis: '47%', flexGrow: 1, backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200], borderLeftWidth: 4, borderRadius: tokens.radii.lg, padding: tokens.spacing[3], gap: tokens.spacing[1] },
  kpiTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  kpiLabel: { ...tokens.typography.bodySm, fontSize: 11, color: tokens.colors.field.textMuted, flex: 1 },
  kpiIcon: { width: 30, height: 30, borderRadius: tokens.radii.md, alignItems: 'center', justifyContent: 'center' },
  kpiVal: { ...tokens.typography.numericSm, fontSize: 22 },
  kpiHint: { ...tokens.typography.bodySm, fontSize: 11, color: tokens.colors.field.textMuted },

  card: { backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200], borderRadius: tokens.radii.xl, padding: tokens.spacing[4] },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], marginBottom: tokens.spacing[2] },
  cardTitle: { ...tokens.typography.headingMd, fontSize: 16, color: tokens.colors.field.text },
  body: { ...tokens.typography.bodyMd, color: tokens.colors.field.text, marginTop: tokens.spacing[1] },
  bodyMuted: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[2] },

  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2], marginTop: tokens.spacing[2], marginBottom: tokens.spacing[1] },
  filterChip: { ...tokens.typography.bodySm, fontSize: 12, fontWeight: '600', color: tokens.colors.field.textMuted, backgroundColor: tokens.colors.neutral[100], borderRadius: tokens.radii.full, paddingHorizontal: tokens.spacing[3], paddingVertical: tokens.spacing[1], overflow: 'hidden' },
  filterChipOn: { backgroundColor: tokens.colors.primary[600], color: tokens.colors.neutral[0] },

  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[4] },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], paddingVertical: tokens.spacing[3] },
  eventBorder: { borderTopWidth: 1, borderTopColor: tokens.colors.neutral[100] },
  eventDisc: { width: 34, height: 34, borderRadius: tokens.radii.full, alignItems: 'center', justifyContent: 'center' },
  eventTitle: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  eventSub: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  eventDate: { ...tokens.typography.bodySm, fontSize: 11, color: tokens.colors.field.textMuted },

  libRow: { flexDirection: 'row', gap: tokens.spacing[3], marginTop: tokens.spacing[1] },
  libStat: { flex: 1, backgroundColor: tokens.colors.neutral[50], borderRadius: tokens.radii.md, padding: tokens.spacing[3] },
  libLabel: { ...tokens.typography.bodySm, fontSize: 11, color: tokens.colors.field.textMuted },
  libVal: { ...tokens.typography.numericSm, fontSize: 20, color: tokens.colors.field.text, marginTop: 2 },
});
