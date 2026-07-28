/**
 * Accueil (home) tab — the field home. Stitch "Tableau de Bord - AviCare
 * Mobile" reference + the web's visual language, with lucide-react-native icons
 * (same family as the web / UVDistribution). Data comes from the web-ported
 * slices (dashboardApi, activityApi) — nothing recomputed.
 */
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import {
  AlertCircle,
  Banknote,
  Bird,
  CheckCircle2,
  ClipboardList,
  Egg,
  Eye,
  HeartPulse,
  LayoutGrid,
  type LucideIcon,
  PackageOpen,
  Pill,
  Plus,
  PlusCircle,
  Scale,
  ShoppingCart,
  Skull,
  Stethoscope,
  Syringe,
  Wallet,
  XCircle,
} from 'lucide-react-native';
import { tokens } from '@/theme';
import { KpiCard, QuickAction, SectionHeader } from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';
import { MicButton } from '@/components/assistant/MicButton';
import { AssistantSheet } from '@/components/assistant/AssistantSheet';
import { useFarmAccess } from '@/auth/useSession';
import { useListFarmsQuery } from '@/store/api/farmsApi';
import { useGetDashboardQuery } from '@/store/api/dashboardApi';
import { useGetFarmActivityQuery } from '@/store/api/activityApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { formatCurrency, formatNumber, formatRelative } from '@/lib/format';
import type { DashboardResponse } from '@/types/dashboard';
import type { ActivityItem } from '@/types';

type Kpi = { label: string; value: string; icon: LucideIcon; tint: string; alert?: boolean };

function pickKpis(d: DashboardResponse): Kpi[] {
  const l = d.livestock;
  const c = d.commercial;
  const out: Kpi[] = [];
  if (l) {
    out.push({ label: 'Effectif vivant', value: formatNumber(l.totalHeadcount), icon: Bird, tint: tokens.colors.primary[500] });
    out.push({ label: 'Mortalité (période)', value: formatNumber(l.deaths), icon: HeartPulse, tint: tokens.colors.error, alert: l.deaths > 0 });
    if (l.layingSeries?.length) {
      out.push({ label: 'Œufs / jour', value: formatNumber(l.layingSeries[l.layingSeries.length - 1]?.valueXof ?? 0), icon: Egg, tint: tokens.colors.accent[400] });
    } else {
      out.push({ label: 'Lots actifs', value: formatNumber(l.activeBatches), icon: LayoutGrid, tint: tokens.colors.info });
    }
  }
  if (c) {
    out.push({ label: 'Ventes (période)', value: formatCurrency(c.revenueXof), icon: Banknote, tint: tokens.colors.primary[500] });
    out.push({ label: 'Impayés', value: formatCurrency(c.overdueXof), icon: AlertCircle, tint: tokens.colors.warning, alert: c.overdueXof > 0 });
  }
  if (out.length < 4 && l) out.push({ label: 'Lots actifs', value: formatNumber(l.activeBatches), icon: LayoutGrid, tint: tokens.colors.info });
  return out.slice(0, 4);
}

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
function activityStyle(kind: string): { icon: LucideIcon; tint: string } {
  return ACTIVITY_STYLE[kind] ?? { icon: ClipboardList, tint: tokens.colors.neutral[500] };
}

function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;
}

export default function HomeScreen() {
  const router = useRouter();
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { can } = useFarmAccess();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const { data: farms } = useListFarmsQuery();
  const farmId = selectedFarmId ?? undefined;

  const { data, isLoading } = useGetDashboardQuery(
    { farmId: farmId as number, query: { period: '30d' } },
    { skip: farmId === undefined },
  );
  const { data: activity } = useGetFarmActivityQuery(
    { farmId: farmId as number, limit: 6 },
    { skip: farmId === undefined },
  );

  const farmName = farms?.find((f) => f.id === farmId)?.name ?? 'Ferme';
  const kpis = useMemo(() => (data ? pickKpis(data) : []), [data]);

  const goToLots = () => router.push('/(field)/(tabs)/elevage');
  const quickActions: Array<{ label: string; icon: LucideIcon; tint: string; onPress: () => void; disabled?: boolean }> = [
    { label: 'Mortalité', icon: Skull, tint: tokens.colors.error, onPress: goToLots },
    { label: 'Œufs', icon: Egg, tint: tokens.colors.accent[400], onPress: goToLots },
    { label: 'Pesée', icon: Scale, tint: tokens.colors.info, onPress: goToLots },
    { label: 'Vaccin', icon: Syringe, tint: tokens.colors.vet, onPress: goToLots, disabled: true },
    { label: 'Soin', icon: Stethoscope, tint: tokens.colors.clients, onPress: goToLots, disabled: true },
    { label: 'Stock', icon: PackageOpen, tint: tokens.colors.accent[600], onPress: goToLots, disabled: true },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.greeting}>Bonjour 👋</Text>
        <Text style={styles.sub}>Voici ce qui se passe sur {farmName} aujourd&apos;hui.</Text>

        {isLoading ? (
          <View style={styles.loading}><ActivityIndicator color={tokens.colors.primary[600]} /></View>
        ) : (
          <>
            <View style={styles.kpiGrid}>
              {kpis.map((k) => (
                <View key={k.label} style={styles.kpiCell}>
                  <KpiCard label={k.label} value={k.value} icon={k.icon} tint={k.tint} alert={k.alert} />
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <SectionHeader title="Actions rapides" />
              <View style={styles.qaGrid}>
                {quickActions.map((a) => (
                  <View key={a.label} style={styles.qaCell}>
                    <QuickAction label={a.label} icon={a.icon} tint={a.tint} onPress={a.onPress} disabled={a.disabled} />
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeader
                title="Activité récente"
                action={
                  <Pressable onPress={goToLots} accessibilityRole="button">
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
          </>
        )}
      </ScrollView>

      {can('poultry:write') && <MicButton onPress={() => setAssistantOpen(true)} style={styles.micFab} />}
      <Pressable style={styles.fab} onPress={goToLots} accessibilityRole="button" accessibilityLabel="Nouvelle saisie">
        <Plus size={30} color={tokens.colors.earth} />
      </Pressable>

      <AssistantSheet visible={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[16] },
  greeting: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  sub: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[1], marginBottom: tokens.spacing[5] },
  loading: { paddingVertical: tokens.spacing[16], alignItems: 'center' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[3] },
  kpiCell: { width: '47%', flexGrow: 1 },
  section: { marginTop: tokens.spacing[6] },
  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[3] },
  qaCell: { width: '30%', flexGrow: 1 },
  link: { ...tokens.typography.bodyMd, color: tokens.colors.primary[600], fontWeight: '600' },
  feed: { backgroundColor: tokens.colors.neutral[0], borderRadius: tokens.radii.xl, borderWidth: 1, borderColor: tokens.colors.neutral[200], overflow: 'hidden' },
  empty: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[6] },
  actRow: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spacing[3], paddingVertical: tokens.spacing[3], paddingHorizontal: tokens.spacing[4] },
  actRowBorder: { borderTopWidth: 1, borderTopColor: tokens.colors.neutral[100] },
  actDisc: { width: 36, height: 36, borderRadius: tokens.radii.full, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  actBody: { flex: 1, minWidth: 0 },
  actLabel: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  actDetail: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  actTime: { ...tokens.typography.bodySm, color: tokens.colors.neutral[400] },
  fab: { position: 'absolute', right: tokens.spacing[5], bottom: tokens.spacing[6], width: 60, height: 60, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.accent[400], alignItems: 'center', justifyContent: 'center', shadowColor: '#1C1917', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  micFab: { position: 'absolute', right: tokens.spacing[5], bottom: tokens.spacing[6] + 72 },
});
