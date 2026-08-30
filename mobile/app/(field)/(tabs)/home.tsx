/**
 * Accueil (home) tab — the field home, redesigned as a bold, stat-forward
 * dashboard: a gradient hero with the farm's headline number + trend sparkline,
 * colorful stat tiles (each with its own mini-trend), an alerts strip, quick
 * actions and the recent-activity feed. All data comes from the web-ported
 * slices (dashboardApi, activityApi) — nothing is recomputed here.
 */
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Bird,
  CheckCircle2,
  ClipboardList,
  Egg,
  Eye,
  HeartPulse,
  LayoutGrid,
  type LucideIcon,
  Minus,
  PackageOpen,
  Pill,
  Plus,
  PlusCircle,
  Receipt,
  Scale,
  ShoppingCart,
  Skull,
  Stethoscope,
  Syringe,
  Truck,
  Wallet,
  XCircle,
} from 'lucide-react-native';
import { tokens } from '@/theme';
import { SectionHeader } from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';
import { Sparkline } from '@/components/charts/Sparkline';
import { MicButton } from '@/components/assistant/MicButton';
import { MyNetworkCard } from '@/components/field/MyNetworkCard';
import { AnnouncementBanner } from '@/components/field/AnnouncementBanner';
import { BenchmarkCard } from '@/components/field/BenchmarkCard';
import { useFarmAccess } from '@/auth/useSession';
import { useListFarmsQuery } from '@/store/api/farmsApi';
import { useGetDashboardQuery } from '@/store/api/dashboardApi';
import { useGetFarmActivityQuery } from '@/store/api/activityApi';
import { selectPeriod, selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { PeriodSelector } from '@/components/PeriodSelector';
import { formatCurrency, formatNumber, formatRelative } from '@/lib/format';
import type { DashboardResponse } from '@/types/dashboard';
import type { ActivityItem } from '@/types';

/* ── helpers ─────────────────────────────────────────────────────────────── */

type Trend = { pct: number | null; dir: 'up' | 'down' | 'flat' };

/** First→last percentage change of a series; flat when <2 points or no base. */
function trendOf(values: number[]): Trend {
  if (values.length < 2) return { pct: null, dir: 'flat' };
  const first = values.find((v) => v !== 0) ?? values[0]!;
  const last = values[values.length - 1]!;
  if (first === 0) return { pct: null, dir: last > 0 ? 'up' : 'flat' };
  const pct = ((last - first) / Math.abs(first)) * 100;
  return { pct, dir: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat' };
}

const greetingWord = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
};

function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;
}

/* ── hero + tiles model ──────────────────────────────────────────────────── */

interface HeroModel {
  label: string;
  value: string;
  series: number[];
  trend: Trend;
  invertTrend?: boolean;
}

interface Tile {
  key: string;
  label: string;
  value: string;
  icon: LucideIcon;
  tint: string;
  series?: number[];
  trend?: Trend;
  invertTrend?: boolean;
  alert?: boolean;
}

function buildHero(d: DashboardResponse): HeroModel {
  const c = d.commercial;
  const l = d.livestock;
  if (c && (c.revenueXof > 0 || (c.revenueSeries?.length ?? 0) > 0)) {
    const series = (c.revenueSeries ?? []).map((p) => p.valueXof);
    return { label: 'Ventes de la période', value: formatCurrency(c.revenueXof), series, trend: trendOf(series) };
  }
  const series = (l?.layingSeries ?? []).map((p) => p.valueXof);
  if (series.length) {
    return { label: 'Œufs collectés / jour', value: formatNumber(series[series.length - 1] ?? 0), series, trend: trendOf(series) };
  }
  const mort = (l?.mortalitySeries ?? []).map((p) => p.valueXof);
  return {
    label: 'Effectif vivant',
    value: formatNumber(l?.totalHeadcount ?? 0),
    series: mort,
    trend: trendOf(mort),
    invertTrend: true,
  };
}

function buildTiles(d: DashboardResponse): Tile[] {
  const l = d.livestock;
  const c = d.commercial;
  const tiles: Tile[] = [];
  if (l) {
    tiles.push({ key: 'headcount', label: 'Effectif vivant', value: formatNumber(l.totalHeadcount), icon: Bird, tint: tokens.colors.primary[500] });
    const mort = l.mortalitySeries.map((p) => p.valueXof);
    tiles.push({
      key: 'deaths',
      label: 'Mortalité',
      value: formatNumber(l.deaths),
      icon: HeartPulse,
      tint: tokens.colors.error,
      trend: trendOf(mort),
      invertTrend: true,
      alert: l.deaths > 0,
    });
    if (l.layingRate != null) {
      tiles.push({ key: 'laying', label: 'Taux de ponte', value: `${l.layingRate.toFixed(0)} %`, icon: Egg, tint: tokens.colors.accent[400], series: l.layingSeries.map((p) => p.valueXof), trend: trendOf(l.layingSeries.map((p) => p.valueXof)) });
    } else if (l.avgDailyGainG != null) {
      tiles.push({ key: 'gain', label: 'Gain / jour', value: `${l.avgDailyGainG.toFixed(0)} g`, icon: Scale, tint: tokens.colors.info });
    } else {
      tiles.push({ key: 'batches', label: 'Lots actifs', value: formatNumber(l.activeBatches), icon: LayoutGrid, tint: tokens.colors.info });
    }
  }
  if (c) {
    tiles.push({ key: 'overdue', label: 'Impayés', value: formatCurrency(c.overdueXof), icon: AlertCircle, tint: tokens.colors.warning, alert: c.overdueXof > 0 });
  } else if (l) {
    tiles.push({ key: 'feed', label: 'Aliment / jour', value: l.dailyFeedKg != null ? `${l.dailyFeedKg.toFixed(1)} kg` : 'n/d', icon: PackageOpen, tint: tokens.colors.accent[600] });
  }
  return tiles.slice(0, 4);
}

interface Alert {
  key: string;
  label: string;
  count: number;
  icon: LucideIcon;
  tint: string;
  onPress: () => void;
}

/* ── activity styling ────────────────────────────────────────────────────── */

const ACTIVITY_STYLE: Record<string, { icon: LucideIcon; tint: string }> = {
  MORTALITY: { icon: HeartPulse, tint: tokens.colors.error },
  SALE_CANCEL: { icon: XCircle, tint: tokens.colors.error },
  VACCINATION_ADMINISTERED: { icon: Syringe, tint: tokens.colors.success },
  TREATMENT_ADMINISTERED: { icon: Pill, tint: tokens.colors.vet },
  VET_VISIT_RECORDED: { icon: Stethoscope, tint: tokens.colors.vet },
  HEALTH_OBSERVATION: { icon: Eye, tint: tokens.colors.warning },
  SALE: { icon: ShoppingCart, tint: tokens.colors.accent[400] },
  PAYMENT: { icon: Wallet, tint: tokens.colors.success },
  EGG_COLLECTION: { icon: Egg, tint: tokens.colors.primary[500] },
  DAILY_RECORD: { icon: ClipboardList, tint: tokens.colors.info },
  DAILY_PRODUCTION_CLOSED: { icon: CheckCircle2, tint: tokens.colors.success },
  COUNT_ADJUSTMENT: { icon: Scale, tint: tokens.colors.neutral[500] },
  CREATED: { icon: PlusCircle, tint: tokens.colors.primary[500] },
};
const activityStyle = (kind: string) => ACTIVITY_STYLE[kind] ?? { icon: ClipboardList, tint: tokens.colors.neutral[500] };

/* ── small components ────────────────────────────────────────────────────── */

function TrendChip({ trend, invert, onDark }: { trend: Trend; invert?: boolean; onDark?: boolean }) {
  if (trend.pct == null || trend.dir === 'flat') {
    return (
      <View style={[styles.trendChip, onDark ? styles.trendChipDark : styles.trendFlat]}>
        <Minus size={12} color={onDark ? tokens.colors.neutral[0] : tokens.colors.neutral[500]} />
        <Text style={[styles.trendText, onDark && styles.trendTextDark]}>—</Text>
      </View>
    );
  }
  // A rising series is "good" by default; for inverted metrics (mortality) a
  // rise is "bad". good → success/white-on-dark, bad → error tint.
  const good = invert ? trend.dir === 'down' : trend.dir === 'up';
  const Icon = trend.dir === 'up' ? ArrowUpRight : ArrowDownRight;
  const tint = onDark ? tokens.colors.neutral[0] : good ? tokens.colors.success : tokens.colors.error;
  const bg = onDark ? 'rgba(255,255,255,0.18)' : good ? tokens.colors.successLight : withAlpha(tokens.colors.error, 0.12);
  return (
    <View style={[styles.trendChip, { backgroundColor: bg }]}>
      <Icon size={12} color={tint} />
      <Text style={[styles.trendText, { color: tint }]}>{Math.abs(trend.pct).toFixed(0)}%</Text>
    </View>
  );
}

/* ── screen ──────────────────────────────────────────────────────────────── */

export default function HomeScreen() {
  const router = useRouter();
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { can } = useFarmAccess();
  const { data: farms } = useListFarmsQuery();
  const farmId = selectedFarmId ?? undefined;
  const period = useSelector(selectPeriod);

  const { data, isLoading } = useGetDashboardQuery(
    { farmId: farmId as number, query: { period } },
    { skip: farmId === undefined },
  );
  const { data: activity } = useGetFarmActivityQuery(
    { farmId: farmId as number, limit: 6 },
    { skip: farmId === undefined },
  );

  const farmName = farms?.find((f) => f.id === farmId)?.name ?? 'Ferme';
  const hero = useMemo(() => (data ? buildHero(data) : null), [data]);
  const tiles = useMemo(() => (data ? buildTiles(data) : []), [data]);

  const goElevage = () => router.push('/(field)/(tabs)/elevage');
  const alerts: Alert[] = useMemo(() => {
    const c = data?.commercial;
    const l = data?.livestock;
    const out: Alert[] = [];
    if (c?.ordersToDeliver) out.push({ key: 'deliver', label: 'À livrer', count: c.ordersToDeliver, icon: Truck, tint: tokens.colors.info, onPress: () => router.push('/(field)/commerce/commandes') });
    if (c?.invoicesToCollect) out.push({ key: 'collect', label: 'À encaisser', count: c.invoicesToCollect, icon: Receipt, tint: tokens.colors.warning, onPress: () => router.push('/(field)/commerce/factures') });
    return out;
  }, [data, router]);

  const quickActions = useMemo(() => {
    const all: Array<{ label: string; icon: LucideIcon; tint: string; onPress: () => void; show: boolean }> = [
      { label: 'Mortalité', icon: Skull, tint: tokens.colors.error, onPress: goElevage, show: can('poultry:write') },
      { label: 'Œufs', icon: Egg, tint: tokens.colors.accent[400], onPress: goElevage, show: can('poultry:write') },
      { label: 'Pesée', icon: Scale, tint: tokens.colors.info, onPress: goElevage, show: can('poultry:write') },
      { label: 'Vente', icon: ShoppingCart, tint: tokens.colors.primary[500], onPress: () => router.push('/(field)/commerce/vente'), show: can('commercial:write') },
      { label: 'Dépense', icon: Wallet, tint: tokens.colors.clients, onPress: () => router.push('/(field)/finance'), show: can('finance:write') },
      { label: 'Stock', icon: PackageOpen, tint: tokens.colors.accent[600], onPress: () => router.push('/(field)/(tabs)/stocks'), show: can('inventory:read') },
    ];
    return all.filter((a) => a.show).slice(0, 6);
  }, [can, router]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Above everything, and outside the loading branch: a maintenance notice matters most
            when the dashboard is the thing that is failing to load. */}
        <AnnouncementBanner />

        {isLoading || !hero ? (
          <View style={styles.loading}><ActivityIndicator color={tokens.colors.primary[600]} /></View>
        ) : (
          <>
            {/* Hero */}
            <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.hero}>
              <LinearGradient
                colors={[tokens.colors.primary[500], tokens.colors.primary[900]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.heroGreeting}>{greetingWord()} 👋</Text>
              <Text style={styles.heroFarm} numberOfLines={1}>{farmName}</Text>

              <View style={styles.heroStatRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroLabel}>{hero.label}</Text>
                  <Text style={styles.heroValue} numberOfLines={1}>{hero.value}</Text>
                </View>
                <TrendChip trend={hero.trend} invert={hero.invertTrend} onDark />
              </View>

              {hero.series.length >= 2 && (
                <View style={styles.heroSpark}>
                  <Sparkline data={hero.series} color={tokens.colors.neutral[0]} width={320} height={56} strokeWidth={2.5} fillOpacity={0.22} />
                </View>
              )}
            </Animated.View>

            {/* Alerts strip */}
            {alerts.length > 0 && (
              <View style={styles.alertRow}>
                {alerts.map((a) => {
                  const Icon = a.icon;
                  return (
                    <Pressable
                      key={a.key}
                      accessibilityRole="button"
                      accessibilityLabel={`${a.label} : ${a.count}`}
                      onPress={a.onPress}
                      style={[styles.alertPill, { borderColor: withAlpha(a.tint, 0.4) }]}
                    >
                      <View style={[styles.alertIcon, { backgroundColor: withAlpha(a.tint, 0.14) }]}>
                        <Icon size={15} color={a.tint} />
                      </View>
                      <View>
                        <Text style={[styles.alertCount, { color: a.tint }]}>{formatNumber(a.count)}</Text>
                        <Text style={styles.alertLabel}>{a.label}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Stat tiles — the period below applies to every one of them. */}
            <PeriodSelector />
            <View style={styles.tileGrid}>
              {tiles.map((t, i) => {
                const Icon = t.icon;
                return (
                  <Animated.View key={t.key} entering={FadeInDown.delay(80 + i * 50).springify().damping(18)} style={styles.tileCell}>
                    <View style={[styles.tile, t.alert && styles.tileAlert]}>
                      <View style={styles.tileTop}>
                        <View style={[styles.tileIcon, { backgroundColor: withAlpha(t.tint, 0.14) }]}>
                          <Icon size={18} color={t.tint} />
                        </View>
                        {t.trend && <TrendChip trend={t.trend} invert={t.invertTrend} />}
                      </View>
                      <Text style={styles.tileValue} numberOfLines={1}>{t.value}</Text>
                      <Text style={styles.tileLabel} numberOfLines={1}>{t.label}</Text>
                      {t.series && t.series.length >= 2 && (
                        <View style={styles.tileSpark}>
                          <Sparkline data={t.series} color={t.tint} width={140} height={28} strokeWidth={2} />
                        </View>
                      )}
                    </View>
                  </Animated.View>
                );
              })}
            </View>

            {/* Quick actions */}
            {quickActions.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="Actions rapides" />
                <View style={styles.qaGrid}>
                  {quickActions.map((a) => {
                    const Icon = a.icon;
                    return (
                      <Pressable
                        key={a.label}
                        accessibilityRole="button"
                        accessibilityLabel={a.label}
                        onPress={a.onPress}
                        style={styles.qaCell}
                      >
                        <View style={[styles.qaDisc, { backgroundColor: withAlpha(a.tint, 0.12), borderColor: withAlpha(a.tint, 0.25) }]}>
                          <Icon size={24} color={a.tint} />
                        </View>
                        <Text style={styles.qaLabel}>{a.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Recent activity */}
            <View style={styles.section}>
              <SectionHeader
                title="Activité récente"
                action={
                  <Pressable onPress={goElevage} accessibilityRole="button">
                    <Text style={styles.link}>Voir tout</Text>
                  </Pressable>
                }
              />
              <View style={styles.feed}>
                {!activity || activity.length === 0 ? (
                  <Text style={styles.empty}>Aucune activité récente.</Text>
                ) : (
                  activity.map((item: ActivityItem, i: number) => {
                    const s = activityStyle(item.kind);
                    const Icon = s.icon;
                    return (
                      <View key={`${item.kind}-${item.at}-${i}`} style={[styles.actRow, i > 0 && styles.actRowBorder]}>
                        <View style={[styles.actDisc, { backgroundColor: withAlpha(s.tint, 0.14) }]}>
                          <Icon size={18} color={s.tint} />
                        </View>
                        <View style={styles.actBody}>
                          <Text style={styles.actLabel} numberOfLines={1}>{item.label}</Text>
                          {item.detail ? <Text style={styles.actDetail} numberOfLines={1}>{item.detail}</Text> : null}
                          <Text style={styles.actTime}>{formatRelative(item.at)}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>

            {/* Co-branding: the networks this farm belongs to. Renders nothing when there is none. */}
            {farmId !== undefined && <MyNetworkCard farmId={farmId} />}

            {/* Last: context, not a figure the morning check depends on. */}
            {farmId !== undefined && <BenchmarkCard farmId={farmId} />}
          </>
        )}
      </ScrollView>

      <MicButton onPress={() => router.push('/(field)/assistant')} style={styles.micFab} />
      <Pressable style={styles.fab} onPress={goElevage} accessibilityRole="button" accessibilityLabel="Nouvelle saisie">
        <Plus size={30} color={tokens.colors.earth} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[16] },
  loading: { paddingVertical: tokens.spacing[16], alignItems: 'center' },

  /* hero */
  hero: {
    borderRadius: tokens.radii.xl,
    overflow: 'hidden',
    padding: tokens.spacing[5],
    marginBottom: tokens.spacing[4],
    shadowColor: tokens.colors.primary[900],
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  heroGreeting: { ...tokens.typography.bodyMd, color: 'rgba(255,255,255,0.85)' },
  heroFarm: { ...tokens.typography.displayMd, color: tokens.colors.neutral[0], marginTop: 2 },
  heroStatRow: { flexDirection: 'row', alignItems: 'flex-end', gap: tokens.spacing[2], marginTop: tokens.spacing[4] },
  heroLabel: { ...tokens.typography.bodySm, color: 'rgba(255,255,255,0.8)' },
  heroValue: { ...tokens.typography.displayLg, fontSize: 32, lineHeight: 38, color: tokens.colors.neutral[0], marginTop: 2, fontVariant: ['tabular-nums'] },
  heroSpark: { marginTop: tokens.spacing[2], marginHorizontal: -tokens.spacing[1], alignItems: 'stretch' },

  /* alerts */
  alertRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2], marginBottom: tokens.spacing[4] },
  alertPill: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], backgroundColor: tokens.colors.neutral[0], borderRadius: tokens.radii.lg, borderWidth: 1, paddingVertical: tokens.spacing[2], paddingHorizontal: tokens.spacing[3], flexGrow: 1 },
  alertIcon: { width: 30, height: 30, borderRadius: tokens.radii.full, alignItems: 'center', justifyContent: 'center' },
  alertCount: { ...tokens.typography.headingMd, fontSize: 17, fontVariant: ['tabular-nums'] },
  alertLabel: { ...tokens.typography.bodySm, fontSize: 11, color: tokens.colors.field.textMuted },

  /* tiles */
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[3] },
  tileCell: { width: '47%', flexGrow: 1 },
  tile: { backgroundColor: tokens.colors.neutral[0], borderRadius: tokens.radii.xl, borderWidth: 1, borderColor: tokens.colors.neutral[200], padding: tokens.spacing[4], overflow: 'hidden', minHeight: 116 },
  tileAlert: { borderColor: withAlpha(tokens.colors.warning, 0.5) },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileIcon: { width: 36, height: 36, borderRadius: tokens.radii.full, alignItems: 'center', justifyContent: 'center' },
  tileValue: { ...tokens.typography.numericSm, fontSize: 24, lineHeight: 30, color: tokens.colors.field.text, marginTop: tokens.spacing[2] },
  tileLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 1 },
  tileSpark: { marginTop: tokens.spacing[1], marginHorizontal: -tokens.spacing[2], marginBottom: -tokens.spacing[2], alignItems: 'stretch' },

  /* trend chip */
  trendChip: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: tokens.radii.full, paddingHorizontal: tokens.spacing[2], paddingVertical: 2 },
  trendFlat: { backgroundColor: tokens.colors.neutral[100] },
  trendChipDark: { backgroundColor: 'rgba(255,255,255,0.18)' },
  trendText: { ...tokens.typography.bodySm, fontSize: 11, fontWeight: '700', color: tokens.colors.neutral[500] },
  trendTextDark: { color: tokens.colors.neutral[0] },

  /* sections */
  section: { marginTop: tokens.spacing[6] },
  link: { ...tokens.typography.bodyMd, color: tokens.colors.primary[600], fontWeight: '600' },

  /* quick actions */
  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[3] },
  qaCell: { width: '30%', flexGrow: 1, alignItems: 'center', gap: tokens.spacing[2], paddingVertical: tokens.spacing[2] },
  qaDisc: { width: 58, height: 58, borderRadius: tokens.radii.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qaLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.text, fontWeight: '600' },

  /* activity */
  feed: { backgroundColor: tokens.colors.neutral[0], borderRadius: tokens.radii.xl, borderWidth: 1, borderColor: tokens.colors.neutral[200], overflow: 'hidden' },
  empty: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[6] },
  actRow: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spacing[3], paddingVertical: tokens.spacing[3], paddingHorizontal: tokens.spacing[4] },
  actRowBorder: { borderTopWidth: 1, borderTopColor: tokens.colors.neutral[100] },
  actDisc: { width: 36, height: 36, borderRadius: tokens.radii.full, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  actBody: { flex: 1, minWidth: 0 },
  actLabel: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  actDetail: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  actTime: { ...tokens.typography.bodySm, color: tokens.colors.neutral[400] },

  /* fabs */
  fab: { position: 'absolute', right: tokens.spacing[5], bottom: tokens.spacing[6], width: 60, height: 60, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.accent[400], alignItems: 'center', justifyContent: 'center', shadowColor: '#1C1917', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  micFab: { position: 'absolute', right: tokens.spacing[5], bottom: tokens.spacing[6] + 72 },
});
