/**
 * Fermes — the selected farm's detail, mirroring the web `/fermes/[id]`
 * (`FarmDetailView`) with three segments: Vue d'ensemble (dashboard KPIs +
 * recent activity), Équipe (team members) and Paramètres (à venir, like the
 * web). Same data (`dashboardApi`, `activityApi`, `membersApi`). The farm shown
 * is the one selected in the header switcher. OWNER / platform ADMIN only;
 * member provisioning stays on the web.
 */
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { MapPin, Plus, Settings2 } from 'lucide-react-native';
import { tokens } from '@/theme';
import { AppHeader } from '@/components/AppHeader';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useListFarmsQuery } from '@/store/api/farmsApi';
import { useGetDashboardQuery } from '@/store/api/dashboardApi';
import { useGetFarmActivityQuery } from '@/store/api/activityApi';
import {
  useCreateMemberMutation,
  useGetMembersQuery,
  useRemoveMemberMutation,
  useResetMemberPasswordMutation,
  useUpdateMemberMutation,
} from '@/store/api/membersApi';
import { useGetPermissionCatalogQuery } from '@/store/api/permissionsApi';
import { useDeleteFarmMutation, useGetFarmQuery, useUpdateFarmMutation } from '@/store/api/farmsApi';
import { MemberSheet } from '@/team/MemberSheet';
import { FarmSheet } from '@/team/FarmSheet';
import { TemporaryPassword } from '@/team/TemporaryPassword';
import { formatNumber } from '@/lib/format';
import { FARM_ROLE_LABELS, memberInitials } from '@/lib/members';
import type { FarmInput } from '@/store/api/farmsApi';
import type { AssignableFarmRole, FarmRole, Member } from '@/types';

type Segment = 'overview' | 'team' | 'settings';

const pct = (v: number | null | undefined) => (v != null ? `${v.toFixed(1)} %` : 'n/d');
const kg = (v: number | null | undefined) => (v != null ? `${v.toFixed(1)} kg` : 'n/d');
const fr = (iso: string) => new Date(iso).toLocaleString('fr-FR');

export default function FermesScreen() {
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { isAdmin, farmRole, session } = useFarmAccess();
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
  const { data: catalog } = useGetPermissionCatalogQuery(seg === 'team' ? undefined : skipToken);
  // The list projection carries no description and no GPS, and `PUT` erases what it is not sent.
  const { data: fullFarm } = useGetFarmQuery(
    seg === 'settings' && selectedFarmId !== null ? selectedFarmId : skipToken,
  );

  const [createMember, { isLoading: creating }] = useCreateMemberMutation();
  const [updateMember, { isLoading: updatingMember }] = useUpdateMemberMutation();
  const [resetPassword] = useResetMemberPasswordMutation();
  const [removeMember] = useRemoveMemberMutation();
  const [updateFarm, { isLoading: savingFarm }] = useUpdateFarmMutation();
  const [deleteFarm] = useDeleteFarmMutation();

  const [memberSheet, setMemberSheet] = useState<{ open: boolean; member: Member | null }>({
    open: false,
    member: null,
  });
  const [farmSheet, setFarmSheet] = useState(false);
  /** Set only while a one-time password is on screen; it cannot be fetched again. */
  const [issued, setIssued] = useState<{ password: string; fullName: string; email: string } | null>(
    null,
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
  // The token loads async — `session` is null on the first render, so only
  // enforce the admin guard once it has resolved (else it flash-redirects to
  // Accueil before isAdmin is known).
  if (session && !isAdmin) return <Redirect href="/(field)" />;

  const roleLabel = (r: FarmRole) => FARM_ROLE_LABELS[r] ?? r;
  // Membership, not tier: the backend gates these on the farm role.
  const canManageTeam = farmRole === 'OWNER' || farmRole === 'MANAGER';
  const canDeleteFarm = farmRole === 'OWNER';

  const submitCreate = async (body: {
    fullName: string;
    email: string;
    phone?: string;
    role: AssignableFarmRole;
    permissions: string[];
  }) => {
    if (selectedFarmId === null) return;
    try {
      const result = await createMember({ farmId: selectedFarmId, body }).unwrap();
      setMemberSheet({ open: false, member: null });
      setIssued({
        password: result.temporaryPassword,
        fullName: result.member.fullName,
        email: result.member.email,
      });
    } catch {
      Alert.alert(
        'Compte non créé',
        "Vérifiez l'adresse e-mail : cette personne est peut-être déjà membre de la ferme.",
      );
    }
  };

  const submitUpdate = async (body: { role: AssignableFarmRole; permissions: string[] }) => {
    const member = memberSheet.member;
    if (selectedFarmId === null || !member) return;
    try {
      await updateMember({ farmId: selectedFarmId, userId: member.userId, body }).unwrap();
      setMemberSheet({ open: false, member: null });
    } catch {
      Alert.alert('Modification refusée', "Les accès n'ont pas été enregistrés.");
    }
  };

  const toggleActive = async (active: boolean) => {
    const member = memberSheet.member;
    if (selectedFarmId === null || !member) return;
    try {
      if (active) {
        await updateMember({
          farmId: selectedFarmId,
          userId: member.userId,
          body: { role: member.role as AssignableFarmRole, permissions: member.permissions, active: true },
        }).unwrap();
      } else {
        await removeMember({ farmId: selectedFarmId, userId: member.userId }).unwrap();
      }
      setMemberSheet({ open: false, member: null });
    } catch {
      Alert.alert('Action refusée', "Le statut du membre n'a pas changé.");
    }
  };

  const doResetPassword = async () => {
    const member = memberSheet.member;
    if (selectedFarmId === null || !member) return;
    try {
      const result = await resetPassword({
        farmId: selectedFarmId,
        userId: member.userId,
      }).unwrap();
      setMemberSheet({ open: false, member: null });
      setIssued({
        password: result.temporaryPassword,
        fullName: member.fullName,
        email: member.email,
      });
    } catch {
      Alert.alert('Réinitialisation refusée', "Le mot de passe n'a pas été changé.");
    }
  };

  const submitFarm = async (body: FarmInput) => {
    if (selectedFarmId === null) return;
    try {
      await updateFarm({ id: selectedFarmId, body }).unwrap();
      setFarmSheet(false);
    } catch {
      Alert.alert('Enregistrement refusé', "Les paramètres n'ont pas été enregistrés.");
    }
  };

  const submitDeleteFarm = async () => {
    if (selectedFarmId === null) return;
    try {
      await deleteFarm(selectedFarmId).unwrap();
      setFarmSheet(false);
    } catch {
      Alert.alert('Suppression refusée', "La ferme n'a pas été supprimée.");
    }
  };

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
            {canManageTeam ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ajouter un membre"
                onPress={() => setMemberSheet({ open: true, member: null })}
                style={styles.addBtn}
              >
                <Plus size={18} color={tokens.colors.action.accumulate.fg} />
                <Text style={styles.addText}>Ajouter un membre</Text>
              </Pressable>
            ) : null}
            {membersLoading ? (
              <Text style={styles.muted}>Chargement…</Text>
            ) : (members ?? []).length === 0 ? (
              <Text style={styles.muted}>Aucun membre.</Text>
            ) : (
              <View style={styles.list}>
                {(members ?? []).map((m, i) => {
                  // OWNER has no editable role and the backend refuses to assign one, so the
                  // owner's own row is informational — opening a sheet on it would dead-end.
                  const editable = canManageTeam && m.role !== 'OWNER';
                  return (
                    <Animated.View
                      key={m.userId}
                      entering={FadeInDown.delay(i * 40).springify().damping(18)}
                    >
                      <Pressable
                        accessibilityRole={editable ? 'button' : undefined}
                        accessibilityLabel={editable ? `Modifier ${m.fullName}` : m.fullName}
                        disabled={!editable}
                        onPress={() => setMemberSheet({ open: true, member: m })}
                        style={[styles.memberRow, !m.active && styles.memberRowOff]}
                      >
                        <View style={[styles.avatar, !m.active && styles.avatarOff]}>
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
                          {!m.active && <Text style={styles.inactive}>Retiré</Text>}
                        </View>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {seg === 'settings' && (
          <View style={styles.list}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Nom</Text>
              <Text style={styles.settingValue}>{fullFarm?.name ?? farm?.name ?? '—'}</Text>
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Localisation</Text>
              <Text style={styles.settingValue}>{fullFarm?.location ?? '—'}</Text>
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Capacité</Text>
              <Text style={styles.settingValue}>
                {fullFarm?.capacity != null ? `${formatNumber(fullFarm.capacity)} sujets` : '—'}
              </Text>
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Devise</Text>
              <Text style={styles.settingValue}>{fullFarm?.currency ?? '—'}</Text>
            </View>

            {canManageTeam ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Modifier la ferme"
                onPress={() => setFarmSheet(true)}
                style={styles.addBtn}
              >
                <Settings2 size={18} color={tokens.colors.action.accumulate.fg} />
                <Text style={styles.addText}>Modifier la ferme</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>

      <MemberSheet
        open={memberSheet.open}
        member={memberSheet.member}
        catalog={catalog}
        saving={creating || updatingMember}
        onClose={() => setMemberSheet({ open: false, member: null })}
        onCreate={submitCreate}
        onUpdate={submitUpdate}
        onResetPassword={doResetPassword}
        onToggleActive={toggleActive}
      />

      <FarmSheet
        open={farmSheet}
        farm={fullFarm}
        saving={savingFarm}
        canDelete={canDeleteFarm}
        onClose={() => setFarmSheet(false)}
        onSubmit={submitFarm}
        onDelete={submitDeleteFarm}
      />

      {issued ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setIssued(null)}>
          <View style={styles.issuedBackdrop} />
          <View style={styles.issuedSheet}>
            <TemporaryPassword
              password={issued.password}
              fullName={issued.fullName}
              email={issued.email}
              onDone={() => setIssued(null)}
            />
          </View>
        </Modal>
      ) : null}
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
  addBtn: {
    minHeight: tokens.touch.primaryButton,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[2],
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.action.accumulate.bg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.accumulate.border,
    marginBottom: tokens.spacing[3],
  },
  addText: { ...tokens.typography.button, color: tokens.colors.action.accumulate.fg },
  memberRowOff: { opacity: 0.62 },
  avatarOff: { backgroundColor: tokens.colors.neutral[300] },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
    paddingVertical: tokens.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.field.ruleSubtle,
  },
  settingLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  settingValue: { ...tokens.typography.bodyMd, color: tokens.colors.field.text, flexShrink: 1, textAlign: 'right' },
  issuedBackdrop: { flex: 1, backgroundColor: 'rgba(28, 25, 23, 0.45)' },
  issuedSheet: {
    backgroundColor: tokens.colors.field.background,
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    paddingBottom: tokens.spacing[6],
  },
});
