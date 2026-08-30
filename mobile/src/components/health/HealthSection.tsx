/**
 * Sanitaire tab content, shared by the broiler and layer lot details.
 *
 * Now the full web `HealthTab`: the vaccination programme and its schedule, the treatments with
 * their withdrawal delays, the vet visits, on top of the vaccinations and observations that were
 * already here.
 *
 * The advanced sections render whatever the server sends. A farm without `module.health.advanced`
 * gets a 403 on those reads, RTK Query hands back no data, and the sections say "none recorded" —
 * which is true for that farm. Hard-guarding them in the client would only duplicate a rule the
 * backend already enforces, and duplicated rules drift.
 */
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, Pill, ShieldCheck, Stethoscope, Syringe } from 'lucide-react-native';
import { fontFamily, tokens } from '@/theme';
import {
  useAssignProgramMutation,
  useGetObservationsQuery,
  useGetProgramAssignmentQuery,
  useGetProgramCatalogQuery,
  useGetScheduleQuery,
  useGetTreatmentsQuery,
  useGetVaccinationsQuery,
  useGetVeterinariansQuery,
  useGetVetVisitsQuery,
  useDeleteTreatmentMutation,
  useDeleteVetVisitMutation,
  useRemoveProgramMutation,
} from '@/store/api/healthApi';
import { useFarmAccess } from '@/auth/useSession';
import { formatNumber } from '@/lib/format';
import { humanizeKey, severityChip } from '@/lib/health';
import { TreatmentsSection } from './TreatmentsSection';
import { VaccinationProgramSection } from './VaccinationProgramSection';
import { VetVisitsSection } from './VetVisitsSection';
import type { HealthObservation, Vaccination } from '@/types';

const MS_PER_DAY = 86_400_000;
/** Days between an ISO date and now (used for the recent-critical window). */
function daysSince(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Infinity : Math.floor((Date.now() - t) / MS_PER_DAY);
}

export function HealthSection({ farmId, unitId }: { farmId: number; unitId: number }) {
  const router = useRouter();
  const { can, isAdmin, farmRole } = useFarmAccess();
  const canWrite = can('health:write');
  // The server gates writes on the programme and deletes on the role, not on a permission.
  const canManage = isAdmin || farmRole === 'OWNER' || farmRole === 'MANAGER';
  const canDeleteTreatment = isAdmin || farmRole === 'OWNER';

  const { data: vaccinations } = useGetVaccinationsQuery({ farmId, unitId });
  const { data: observations } = useGetObservationsQuery({ farmId, unitId });
  const { data: assignment, isLoading: assignmentLoading } = useGetProgramAssignmentQuery({
    farmId,
    unitId,
  });
  const { data: schedule = [] } = useGetScheduleQuery({ farmId, unitId });
  const { data: programs = [] } = useGetProgramCatalogQuery({ farmId });
  const { data: treatments = [] } = useGetTreatmentsQuery({ farmId, unitId });
  const { data: vetVisits = [] } = useGetVetVisitsQuery({ farmId, unitId });
  const { data: veterinarians = [] } = useGetVeterinariansQuery({ farmId });

  const [assignProgram] = useAssignProgramMutation();
  const [removeProgram] = useRemoveProgramMutation();
  const [deleteTreatment] = useDeleteTreatmentMutation();
  const [deleteVetVisit] = useDeleteVetVisitMutation();

  // Lot health status. The web flags VIGILANCE on a recent critical observation **or** a late
  // dose; mobile only looked at observations, so a lot with three overdue vaccines still read
  // "SAIN". A status that cannot say "something is wrong" is worse than no status.
  const recentCritical = (observations ?? []).filter(
    (o) =>
      (o.severity === 'CRITICAL' || o.severity === 'WARNING') && daysSince(o.observationDate) <= 7,
  ).length;
  const lateDoses = schedule.filter((s) => s.status === 'LATE').length;
  const healthy = recentCritical === 0 && lateDoses === 0;

  // What is wrong, named. Empty when nothing is — the banner then says so itself.
  const reasons: string[] = [];
  if (lateDoses > 0) reasons.push(`${lateDoses} dose${lateDoses > 1 ? 's' : ''} en retard`);
  if (recentCritical > 0) {
    reasons.push(
      `${recentCritical} observation${recentCritical > 1 ? 's' : ''} à surveiller`,
    );
  }

  // Context, not the answer: the ratio matters only against the programme's own length.
  const doneDoses = schedule.filter((s) => s.status === 'DONE').length;
  const facts = [
    schedule.length > 0
      ? `${doneDoses}/${schedule.length} doses`
      : `${formatNumber(vaccinations?.length ?? 0)} vaccination${(vaccinations?.length ?? 0) > 1 ? 's' : ''}`,
    `${formatNumber(observations?.length ?? 0)} observation${(observations?.length ?? 0) > 1 ? 's' : ''}`,
  ];

  return (
    <View style={{ gap: tokens.spacing[4] }}>
      {/*
        One verdict, not three tiles.
        The three cards that used to sit here — Vaccinations 4/7, Observations 0, État VIGILANCE —
        were the same fact told three times: the status was *derived* from the other two, and the
        late doses were then repeated a third time by the programme card below. Three boxes to
        read before learning one thing.
        This says the thing: what is wrong, in words, or that nothing is. The supporting counts
        stay as one quiet line underneath, because they are context, not the answer.
      */}
      <View style={[styles.verdict, healthy ? styles.verdictOk : styles.verdictWarn]}>
        <ShieldCheck
          size={22}
          color={healthy ? tokens.colors.successDark : tokens.colors.warningDark}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.verdictTitle, healthy ? styles.verdictTextOk : styles.verdictTextWarn]}>
            {healthy ? 'Tout est à jour' : reasons.join(' · ')}
          </Text>
          <Text style={styles.verdictSub}>{facts.join(' · ')}</Text>
        </View>
      </View>

      {/* Record actions (basic module) — gated by health:write. */}
      {canWrite && (
        <View style={styles.actions}>
          <Pressable style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]} onPress={() => router.push(`/(field)/lots/${unitId}/vaccination`)} accessibilityRole="button" accessibilityLabel="Nouvelle vaccination">
            <Syringe size={18} color={tokens.colors.primary[700]} />
            <Text style={styles.actionText}>Vaccination</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]} onPress={() => router.push(`/(field)/lots/${unitId}/observation`)} accessibilityRole="button" accessibilityLabel="Nouvelle observation">
            <Eye size={18} color={tokens.colors.primary[700]} />
            <Text style={styles.actionText}>Observation</Text>
          </Pressable>
          {/* Recording a treatment or a visit is OWNER/MANAGER server-side, so the buttons are
              absent for anyone else rather than present and answered with a 403. */}
          {canManage && (
            <Pressable
              style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(`/(field)/lots/${unitId}/traitement`)}
              accessibilityRole="button"
              accessibilityLabel="Nouveau traitement"
            >
              <Pill size={18} color={tokens.colors.primary[700]} />
              <Text style={styles.actionText}>Traitement</Text>
            </Pressable>
          )}
          {canManage && (
            <Pressable
              style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(`/(field)/lots/${unitId}/visite-veto`)}
              accessibilityRole="button"
              accessibilityLabel="Nouvelle visite vétérinaire"
            >
              <Stethoscope size={18} color={tokens.colors.primary[700]} />
              <Text style={styles.actionText}>Visite véto</Text>
            </Pressable>
          )}
        </View>
      )}

      <VaccinationProgramSection
        assignment={assignment}
        schedule={schedule}
        programs={programs}
        loading={assignmentLoading}
        canManage={canManage}
        onAssign={(programKey) => {
          assignProgram({ farmId, unitId, programKey });
        }}
        onRemove={() => {
          removeProgram({ farmId, unitId });
        }}
        onRecordDose={(step) =>
          router.push({
            pathname: '/(field)/lots/[unitId]/vaccination',
            params: { unitId: String(unitId), vaccineKey: step.vaccineKey },
          })
        }
      />

      <TreatmentsSection
        treatments={treatments}
        canDelete={canDeleteTreatment}
        onDelete={(treatment) =>
          Alert.alert(
            'Supprimer ce traitement ?',
            "Le traitement et le délai d'attente qu'il a ouvert disparaîtront de l'historique du lot. Cette action est irréversible.",
            [
              { text: 'Annuler', style: 'cancel' },
              {
                text: 'Supprimer',
                style: 'destructive',
                onPress: () => {
                  deleteTreatment({ farmId, id: treatment.id, unitId });
                },
              },
            ],
          )
        }
      />

      <VetVisitsSection
        visits={vetVisits}
        veterinarians={veterinarians}
        canDelete={canManage}
        onDelete={(visit) =>
          Alert.alert(
            'Supprimer cette visite ?',
            visit.costXof
              ? `La dépense de ${formatNumber(visit.costXof)} F enregistrée pour cette visite sera annulée dans votre comptabilité.`
              : 'La visite disparaîtra de l\'historique du lot.',
            [
              { text: 'Annuler', style: 'cancel' },
              {
                text: 'Supprimer',
                style: 'destructive',
                onPress: () => {
                  deleteVetVisit({ farmId, id: visit.id, unitId });
                },
              },
            ],
          )
        }
      />

      {/* Vaccinations */}
      <View style={styles.card}>
        <Text style={styles.title}>Vaccinations</Text>
        {!vaccinations || vaccinations.length === 0 ? (
          <Text style={styles.muted}>Aucune vaccination enregistrée.</Text>
        ) : (
          vaccinations.slice().reverse().map((v: Vaccination, i) => (
            <View key={v.id} style={[styles.row, i > 0 && styles.border]}>
              <View style={[styles.disc, { backgroundColor: tokens.colors.successLight }]}><Syringe size={16} color={tokens.colors.success} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{humanizeKey(v.vaccineKey)}</Text>
                <Text style={styles.rowSub}>{v.administeredDate} · {formatNumber(v.subjectsCount)} sujets{v.route ? ` · ${v.route}` : ''}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Observations */}
      <View style={styles.card}>
        <Text style={styles.title}>Observations</Text>
        {!observations || observations.length === 0 ? (
          <Text style={styles.muted}>Aucune observation.</Text>
        ) : (
          observations.slice().reverse().map((o: HealthObservation, i) => {
            const sev = severityChip(o.severity);
            return (
              <View key={o.id} style={[styles.row, i > 0 && styles.border]}>
                <View style={[styles.disc, { backgroundColor: sev.bg }]}><Eye size={16} color={sev.fg} /></View>
                <View style={{ flex: 1 }}>
                  <View style={styles.obsHead}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{o.title}</Text>
                    <View style={[styles.sevChip, { backgroundColor: sev.bg }]}><Text style={[styles.sevText, { color: sev.fg }]}>{sev.label}</Text></View>
                  </View>
                  <Text style={styles.rowSub}>{o.observationDate}{o.description ? ` · ${o.description}` : ''}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  verdict: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing[4],
  },
  verdictOk: { backgroundColor: tokens.colors.successLight },
  verdictWarn: { backgroundColor: tokens.colors.warningLight },
  verdictTitle: { ...tokens.typography.bodyLg, fontFamily: fontFamily.sansSemiBold },
  verdictTextOk: { color: tokens.colors.successDark },
  verdictTextWarn: { color: tokens.colors.warningDark },
  verdictSub: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },

  /*
    A 2-column grid, not a 4-across row.
    The row gave each button `flex: 1` with the icon and label side by side; the labels do not
    shrink, so "Visite véto" ran off the screen and the icons landed on top of the neighbouring
    label. Half-width cells with the icon above the label cannot overflow — the label has the
    whole cell to wrap in — and a fifth action later just starts a third row.
  */
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[3] },
  actionBtn: {
    width: '47%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[1],
    minHeight: tokens.touch.primaryButton,
    paddingVertical: tokens.spacing[3],
    paddingHorizontal: tokens.spacing[2],
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.primary[600],
    backgroundColor: tokens.colors.primary[50],
  },
  actionText: {
    ...tokens.typography.button,
    fontSize: 14,
    color: tokens.colors.primary[700],
    textAlign: 'center',
  },
  card: { backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200], borderRadius: tokens.radii.xl, padding: tokens.spacing[4] },
  title: { ...tokens.typography.headingMd, color: tokens.colors.field.text, marginBottom: tokens.spacing[2] },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], paddingVertical: tokens.spacing[3] },
  border: { borderTopWidth: 1, borderTopColor: tokens.colors.neutral[100] },
  disc: { width: 34, height: 34, borderRadius: tokens.radii.full, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  rowSub: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  obsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing[2] },
  sevChip: { borderRadius: tokens.radii.full, paddingHorizontal: tokens.spacing[2], paddingVertical: 2 },
  sevText: { ...tokens.typography.bodySm, fontWeight: '700', fontSize: 10 },
  lockCard: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], backgroundColor: tokens.colors.neutral[100], borderColor: tokens.colors.neutral[200] },
  lockText: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, flex: 1 },
});
