/**
 * Fermes — the selected farm's detail, mirroring the web `/fermes/[id]`
 * (`FarmDetailView`) with three segments: Vue d'ensemble (dashboard KPIs +
 * recent activity), Équipe (team members) and Paramètres (à venir, like the
 * web). Same data (`dashboardApi`, `activityApi`, `membersApi`). The farm shown
 * is the one selected in the header switcher. OWNER / platform ADMIN only;
 * member provisioning stays on the web.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { MapPin, Users } from 'lucide-react-native';
import { tokens } from '@/theme';
import { AppHeader } from '@/components/AppHeader';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useListFarmsQuery } from '@/store/api/farmsApi';
import { useGetDashboardQuery } from '@/store/api/dashboardApi';
import { useGetFarmActivityQuery } from '@/store/api/activityApi';
import { useGetMembersQuery } from '@/store/api/membersApi';
import { formatNumber } from '@/lib/format';
import { FARM_ROLE_LABELS, memberInitials } from '@/lib/members';
import type { FarmRole } from '@/types';

type Segment = 'overview' | 'team' | 'settings';

const pct = (v: number | null | undefined) => (v != null ? `${v.toFixed(1)} %` : 'n/d');
const kg = (v: number | null | undefined) => (v != null ? `${v.toFixed(1)} kg` : 'n/d');
const fr = (iso: string) => new Date(iso).toLocaleString('fr-FR');

export default function FermesScreen() {
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { isAdmin } = useFarmAccess();
  const [seg, setSeg] = useState<Segment>('overview');

  const { data: farms } = useListFarmsQuery();
  const farm = farms?.find((f) => f.id === selectedFarmId);

  const { data: dashboard, isLoading: dashLoading } = useGetDashboardQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId, query: { period: '7d' } },
  );
  const { data: activity = [], isLoading: activityLoading } = useGetFarmActivityQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId, limit: 20 },
  );
  const { data: members, isLoading: membersLoading } = useGetMembersQuery(
    seg === 'team' && selectedFarmId !== null ? selectedFarmId : skipToken,
  );

  const ls = dashboard?.livestock;
  const cards = useMemo(
    () => [
      { label: 'Effectif total', hint: 'Sujets actifs', value: dashLoading ? '…' : ls ? formatNumber(ls.totalHeadcount) : 'n/d' },
      { label: 'Mortalité', hint: 'Sur 7 jours', value: dashLoading ? '…' : pct(ls?.mortalityRate) },
      { label: 'Ponte (7j)', hint: 'Taux de ponte', value: dashLoading ? '…' : pct(ls?.layingRate) },
      { label: 'Aliment / jour', hint: 'Conso. moyenne', value: dashLoading ? '…' : kg(ls?.dailyFeedKg) },
    ],
    [dashLoading, ls],
  );

  if (selectedFarmId === null) return <Redirect href="/(field)" />;
  if (!isAdmin) return <Redirect href="/(field)" />;

  const roleLabel = (r: FarmRole) => FARM_ROLE_LABELS[r] ?? r;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Farm hero */}
        <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.hero}>
          <LinearGradient
            colors={[tokens.colors.primary[600], tokens.colors.primary[900]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroTop}>
            <Text style={styles.heroName} numberOfLines={1}>{farm?.name ?? 'Ferme'}</Text>
            <View style={[styles.statusChip, (farm?.active ?? true) ? styles.statusOn : styles.statusOff]}>
              <Text style={styles.statusText}>{(farm?.active ?? true) ? 'Opérationnel' : 'Inactif'}</Text>
            </View>
          </View>
          {farm?.location ? (
            <View style={styles.locationRow}>
              <MapPin size={13} color="rgba(255,255,255,0.85)" />
              <Text style={styles.location}>{farm.location}</Text>
            </View>
          ) : null}
        </Animated.View>

        {/* Segmented control */}
        <View style={styles.segment}>
          {(
            [
              ['overview', "Vue d'ensemble"],
              ['team', 'Équipe'],
              ['settings', 'Paramètres'],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`Onglet ${label}`}
              onPress={() => setSeg(key)}
              style={[styles.segmentBtn, seg === key && styles.segmentBtnOn]}
            >
              <Text style={[styles.segmentText, seg === key && styles.segmentTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {seg === 'overview' && (
          <View>
            <View style={styles.kpiGrid}>
              {cards.map((c, i) => (
                <Animated.View key={c.label} entering={FadeInDown.delay(i * 40).springify().damping(18)} style={styles.kpi}>
                  <Text style={styles.kpiLabel}>{c.label}</Text>
                  <Text style={styles.kpiVal}>{c.value}</Text>
                  <Text style={styles.kpiHint}>{c.hint}</Text>
                </Animated.View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Activité récente</Text>
            {activityLoading ? (
              <Text style={styles.muted}>Chargement…</Text>
            ) : activity.length === 0 ? (
              <Text style={styles.muted}>Aucune activité récente.</Text>
            ) : (
              <View style={styles.list}>
                {activity.map((item, i) => (
                  <View key={`${item.at}-${i}`} style={styles.activityRow}>
                    <View style={styles.dot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityLabel}>{item.label}</Text>
                      <Text style={styles.activityAt}>{fr(item.at)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {seg === 'team' && (
          <View>
            <View style={styles.note}>
              <Users size={16} color={tokens.colors.primary[600]} />
              <Text style={styles.noteText}>
                Ajoutez ou modifiez des membres depuis l&apos;application web.
              </Text>
            </View>
            {membersLoading ? (
              <Text style={styles.muted}>Chargement…</Text>
            ) : (members ?? []).length === 0 ? (
              <Text style={styles.muted}>Aucun membre.</Text>
            ) : (
              <View style={styles.list}>
                {(members ?? []).map((m, i) => (
                  <Animated.View key={m.userId} entering={FadeInDown.delay(i * 40).springify().damping(18)} style={styles.memberRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{memberInitials(m.fullName) || '?'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName} numberOfLines={1}>{m.fullName}</Text>
                      <Text style={styles.memberEmail} numberOfLines={1}>{m.email}</Text>
                    </View>
                    <View style={styles.memberRight}>
                      <View style={styles.roleChip}>
                        <Text style={styles.roleText}>{roleLabel(m.role)}</Text>
                      </View>
                      {!m.active && <Text style={styles.inactive}>Inactif</Text>}
                    </View>
                  </Animated.View>
                ))}
              </View>
            )}
          </View>
        )}

        {seg === 'settings' && (
          <Text style={styles.muted}>Paramètres de la ferme — à venir.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[16] },

  hero: {
    borderRadius: tokens.radii.xl,
    overflow: 'hidden',
    padding: tokens.spacing[5],
    gap: tokens.spacing[2],
    marginBottom: tokens.spacing[4],
    shadowColor: tokens.colors.primary[900],
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing[2] },
  heroName: { ...tokens.typography.displayMd, color: tokens.colors.neutral[0], flex: 1 },
  statusChip: { borderRadius: tokens.radii.full, paddingHorizontal: tokens.spacing[2], paddingVertical: 2 },
  statusOn: { backgroundColor: 'rgba(255,255,255,0.22)' },
  statusOff: { backgroundColor: 'rgba(0,0,0,0.25)' },
  statusText: { ...tokens.typography.bodySm, fontSize: 10, fontWeight: '700', color: tokens.colors.neutral[0] },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  location: { ...tokens.typography.bodySm, color: 'rgba(255,255,255,0.85)' },

  segment: { flexDirection: 'row', backgroundColor: tokens.colors.neutral[100], borderRadius: tokens.radii.full, padding: 4, marginBottom: tokens.spacing[4] },
  segmentBtn: { flex: 1, paddingVertical: tokens.spacing[2], borderRadius: tokens.radii.full, alignItems: 'center' },
  segmentBtnOn: { backgroundColor: tokens.colors.neutral[0], shadowColor: tokens.colors.primary[900], shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  segmentText: { ...tokens.typography.bodySm, fontWeight: '600', color: tokens.colors.field.textMuted },
  segmentTextOn: { color: tokens.colors.primary[700] },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[3], marginBottom: tokens.spacing[5] },
  kpi: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: tokens.colors.neutral[0],
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    borderRadius: tokens.radii.xl,
    padding: tokens.spacing[4],
    gap: 2,
  },
  kpiLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  kpiVal: { ...tokens.typography.numericSm, fontSize: 20, color: tokens.colors.field.text },
  kpiHint: { ...tokens.typography.bodySm, fontSize: 11, color: tokens.colors.neutral[500] },

  sectionTitle: { ...tokens.typography.headingMd, fontSize: 15, color: tokens.colors.field.text, marginBottom: tokens.spacing[2] },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[6] },
  list: { gap: tokens.spacing[2] },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    padding: tokens.spacing[3],
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colors.primary[500] },
  activityLabel: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  activityAt: { ...tokens.typography.bodySm, color: tokens.colors.neutral[500], marginTop: 1 },

  note: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], backgroundColor: tokens.colors.primary[50], borderRadius: tokens.radii.lg, padding: tokens.spacing[3], marginBottom: tokens.spacing[3] },
  noteText: { ...tokens.typography.bodySm, color: tokens.colors.primary[700], flex: 1 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.radii.xl,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    padding: tokens.spacing[3],
  },
  avatar: { width: 40, height: 40, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.primary[100], alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...tokens.typography.bodySm, fontWeight: '700', color: tokens.colors.primary[700] },
  memberName: { ...tokens.typography.bodyMd, fontWeight: '700', color: tokens.colors.field.text },
  memberEmail: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  memberRight: { alignItems: 'flex-end', gap: 2 },
  roleChip: { borderRadius: tokens.radii.full, borderWidth: 1, borderColor: tokens.colors.primary[300], paddingHorizontal: tokens.spacing[2], paddingVertical: 1 },
  roleText: { ...tokens.typography.bodySm, fontSize: 10, fontWeight: '700', color: tokens.colors.primary[700] },
  inactive: { ...tokens.typography.bodySm, fontSize: 10, color: tokens.colors.warning, fontWeight: '600' },
});
