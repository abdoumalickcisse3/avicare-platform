/**
 * Vaccination programme and schedule for one lot.
 *
 * The web draws this as a horizontal timeline at 26px per day — the "critical business view",
 * and unreadable on five inches. Ported faithfully it would be a strip nobody scrolls.
 *
 * So it is rebuilt around the question the farmer actually opens it with: **what is late?**
 * Late steps come first and are the only ones that shout. Upcoming steps follow. Done steps
 * are collapsed behind a count, because they are the answer to "have I finished", not to
 * "what do I do today".
 *
 * A step is DONE when a vaccination with the same key exists — the server matches on the key
 * alone, not on the date — so a dose given a week early still clears its step.
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronRight, Syringe } from 'lucide-react-native';
import { fontFamily, tokens } from '@/theme';
import { ageLabel, humanizeKey, scheduleStatusColor, scheduleStatusLabel } from '@/lib/health';
import type { ProgramAssignment, VaccinationProgram, VaccinationScheduleStatus } from '@/types';

function frenchDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export type VaccinationProgramSectionProps = {
  assignment: ProgramAssignment | null | undefined;
  schedule: VaccinationScheduleStatus[];
  programs: VaccinationProgram[];
  /** Null while the caller is still loading, so the empty state is not shown too early. */
  loading?: boolean;
  canManage: boolean;
  onAssign: (programKey: string) => void;
  onRemove: () => void;
  onRecordDose: (step: VaccinationScheduleStatus) => void;
};

export function VaccinationProgramSection({
  assignment,
  schedule,
  programs,
  loading = false,
  canManage,
  onAssign,
  onRemove,
  onRecordDose,
}: VaccinationProgramSectionProps) {
  const [showDone, setShowDone] = useState(false);

  const { late, upcoming, done } = useMemo(
    () => ({
      late: schedule.filter((s) => s.status === 'LATE'),
      upcoming: schedule.filter((s) => s.status === 'UPCOMING'),
      done: schedule.filter((s) => s.status === 'DONE'),
    }),
    [schedule],
  );

  if (loading) return null;

  if (!assignment) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Programme de vaccination</Text>
        <Text style={styles.muted}>
          Aucun programme suivi pour ce lot. En assigner un affiche les doses à faire et signale
          celles en retard.
        </Text>
        {canManage ? (
          <View style={styles.programList}>
            {programs.length === 0 ? (
              <Text style={styles.muted}>Aucun programme disponible pour cette souche.</Text>
            ) : (
              programs.map((program) => (
                <Pressable
                  key={program.key}
                  onPress={() => onAssign(program.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Suivre le programme ${program.label}`}
                  style={({ pressed }) => [styles.programRow, pressed && styles.pressed]}
                >
                  <View style={styles.programText}>
                    <Text style={styles.programLabel}>{program.label}</Text>
                    <Text style={styles.muted}>{program.schedule.length} doses prévues</Text>
                  </View>
                  <ChevronRight size={20} color={tokens.colors.field.textMuted} />
                </Pressable>
              ))
            )}
          </View>
        ) : (
          <Text style={styles.muted}>
            Seul le propriétaire ou un gérant peut assigner un programme.
          </Text>
        )}
      </View>
    );
  }

  const program = programs.find((p) => p.key === assignment.programKey);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Syringe size={18} color={tokens.colors.field.text} />
        <Text style={styles.title}>{program?.label ?? humanizeKey(assignment.programKey)}</Text>
      </View>

      {/* The late count used to be repeated here. The verdict banner at the top of the tab now
          says it once, and saying it twice on one screen made the reader check whether the two
          numbers agreed. Only the "nothing late" case stays, because the banner's silence about
          this programme is not the same as this programme being clear. */}
      {late.length === 0 && <Text style={styles.muted}>Aucune dose en retard.</Text>}

      {/* Late first, and the only group that shouts: it is the reason this screen is opened. */}
      {[...late, ...upcoming].map((step) => (
        <Pressable
          key={`${step.vaccineKey}-${step.dueDate}`}
          onPress={() => onRecordDose(step)}
          accessibilityRole="button"
          accessibilityLabel={`Saisir ${humanizeKey(step.vaccineKey)}`}
          style={({ pressed }) => [styles.step, pressed && styles.pressed]}
        >
          <View style={[styles.stepMark, { backgroundColor: scheduleStatusColor(step.status) }]} />
          <View style={styles.stepText}>
            {/* One Text per string: nesting them splits the label across nodes, which reads
                the same on screen and cannot be found by name in a test or by a screen reader. */}
            <Text style={styles.stepVaccine}>{humanizeKey(step.vaccineKey)}</Text>
            {/* The status sits under the name, not at the far right.
                Pinned right, it landed underneath the floating action button on a narrow screen —
                the one word that says "act on this" was the one covered. Nothing lives at the
                right edge now, so no overlay can ever reach it. */}
            <Text style={[styles.stepStatus, { color: scheduleStatusColor(step.status) }]}>
              {scheduleStatusLabel(step.status)}
            </Text>
            <Text style={styles.muted}>
              {`${ageLabel(step.ageValue, step.ageUnit)} · prévue le ${frenchDate(step.dueDate)}${
                step.mandatory ? ' · obligatoire' : ''
              }`}
            </Text>
          </View>
        </Pressable>
      ))}

      {done.length > 0 && (
        <Pressable
          onPress={() => setShowDone((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={showDone ? 'Masquer les doses faites' : 'Voir les doses faites'}
          style={styles.doneToggle}
        >
          <ChevronDown size={18} color={tokens.colors.field.textMuted} />
          <Text style={styles.muted}>
            {done.length} dose{done.length > 1 ? 's' : ''} déjà faite{done.length > 1 ? 's' : ''}
          </Text>
        </Pressable>
      )}

      {showDone &&
        done.map((step) => (
          <View key={`${step.vaccineKey}-${step.dueDate}`} style={styles.step}>
            <View
              style={[styles.stepMark, { backgroundColor: scheduleStatusColor(step.status) }]}
            />
            <View style={styles.stepText}>
              <Text style={styles.stepVaccine}>{humanizeKey(step.vaccineKey)}</Text>
              <Text style={styles.muted}>{ageLabel(step.ageValue, step.ageUnit)}</Text>
            </View>
            <Text style={[styles.stepStatus, { color: scheduleStatusColor(step.status) }]}>
              {scheduleStatusLabel(step.status)}
            </Text>
          </View>
        ))}

      {canManage && (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel="Retirer le programme"
          style={styles.removeRow}
        >
          <Text style={styles.remove}>Retirer ce programme</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.field.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.field.ruleSubtle,
    padding: tokens.spacing[4],
    gap: tokens.spacing[3],
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  title: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  muted: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  lateSummary: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.error,
    fontFamily: fontFamily.sansSemiBold,
  },
  programList: { gap: tokens.spacing[2] },
  programRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    minHeight: tokens.touch.button,
    paddingVertical: tokens.spacing[2],
  },
  programText: { flex: 1, gap: 2 },
  programLabel: { ...tokens.typography.bodyLg, color: tokens.colors.field.text },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    minHeight: tokens.touch.button,
    paddingVertical: tokens.spacing[2],
  },
  stepMark: { width: 6, height: 36, borderRadius: 3 },
  stepText: { flex: 1, gap: 2 },
  stepVaccine: { ...tokens.typography.bodyLg, color: tokens.colors.field.text },
  stepStatus: { ...tokens.typography.bodySm, fontFamily: fontFamily.sansSemiBold },
  doneToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    minHeight: tokens.touch.min,
  },
  removeRow: { minHeight: tokens.touch.min, justifyContent: 'center' },
  remove: { ...tokens.typography.bodySm, color: tokens.colors.error },
  pressed: { opacity: 0.7 },
});
