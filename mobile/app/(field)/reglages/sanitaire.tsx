/**
 * Bibliothèque sanitaire — vaccines, treatments, programmes and the veterinarian directory.
 *
 * A dedicated route rather than the generic `[category]` placeholder, exactly as on the web: a
 * static file wins over the `[param]` sibling in Expo Router, so `/reglages/sanitaire` lands
 * here while the other settings slugs keep their generic screen.
 *
 * Four sections, one at a time. The web puts them in tabs of one card; on a phone that would
 * mean four horizontally-scrolling tables, so the sections are chip-selected and each is a list
 * of rows rather than a grid of columns.
 *
 * Programmes are read-only everywhere, web included: custom programmes are explicitly out of
 * scope, and a section that offered an edit that does not exist would be a lie.
 */
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft, Pencil, Phone, Plus, Trash2 } from 'lucide-react-native';
import { fontFamily, tokens } from '@/theme';
import { ActionBar } from '@/components/field/ActionBar';
import { HealthCatalogSheet, confirmCatalogDelete } from '@/health/HealthCatalogSheet';
import { VeterinarianSheet, confirmVeterinarianRemoval } from '@/health/VeterinarianSheet';
import {
  useCreateVeterinarianMutation,
  useDeactivateVeterinarianMutation,
  useDeleteTreatmentCatalogMutation,
  useDeleteVaccineMutation,
  useGetProgramCatalogQuery,
  useGetTreatmentLibraryQuery,
  useGetVaccineCatalogQuery,
  useGetVeterinariansQuery,
  useUpdateVeterinarianMutation,
  useUpsertTreatmentCatalogMutation,
  useUpsertVaccineMutation,
} from '@/store/api/healthApi';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { ageLabel, humanizeKey, routeLabel } from '@/lib/health';
import type { Treatment, Vaccine, Veterinarian, VeterinarianInput } from '@/types';

type Section = 'vaccins' | 'traitements' | 'programmes' | 'veterinaires';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'vaccins', label: 'Vaccins' },
  { key: 'traitements', label: 'Traitements' },
  { key: 'programmes', label: 'Programmes' },
  { key: 'veterinaires', label: 'Vétérinaires' },
];

export default function HealthLibraryScreen() {
  const router = useRouter();
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { isAdmin, farmRole } = useFarmAccess();
  // The backend gates catalog and directory writes on the role, not on a permission.
  const canManage = isAdmin || farmRole === 'OWNER' || farmRole === 'MANAGER';

  const [section, setSection] = useState<Section>('vaccins');
  const [catalogSheet, setCatalogSheet] = useState<{
    kind: 'vaccine' | 'treatment';
    entry: Vaccine | Treatment | null;
  } | null>(null);
  const [vetSheet, setVetSheet] = useState<{ vet: Veterinarian | null } | null>(null);

  const farmArg = selectedFarmId ? { farmId: selectedFarmId } : skipToken;
  const { data: vaccines = [] } = useGetVaccineCatalogQuery(farmArg);
  const { data: treatments = [] } = useGetTreatmentLibraryQuery(farmArg);
  const { data: programs = [] } = useGetProgramCatalogQuery(farmArg);
  const { data: veterinarians = [] } = useGetVeterinariansQuery(farmArg);

  const [upsertVaccine, { isLoading: savingVaccine }] = useUpsertVaccineMutation();
  const [deleteVaccine] = useDeleteVaccineMutation();
  const [upsertTreatment, { isLoading: savingTreatment }] = useUpsertTreatmentCatalogMutation();
  const [deleteTreatment] = useDeleteTreatmentCatalogMutation();
  const [createVet, { isLoading: creatingVet }] = useCreateVeterinarianMutation();
  const [updateVet, { isLoading: updatingVet }] = useUpdateVeterinarianMutation();
  const [deactivateVet] = useDeactivateVeterinarianMutation();

  const existingKeys = useMemo(
    () => (catalogSheet?.kind === 'vaccine' ? vaccines : treatments).map((e) => e.key),
    [catalogSheet?.kind, vaccines, treatments],
  );

  if (selectedFarmId === null) return <Redirect href="/(field)" />;

  const failed = (verb: string) => () =>
    Alert.alert(
      `${verb} impossible`,
      "Vérifiez votre connexion. Si le problème persiste, votre rôle ne permet peut-être pas cette action.",
    );

  const submitCatalog = (key: string, value: Record<string, unknown>) => {
    const mutate = catalogSheet?.kind === 'vaccine' ? upsertVaccine : upsertTreatment;
    mutate({ farmId: selectedFarmId, key, value })
      .unwrap()
      .then(() => setCatalogSheet(null))
      .catch(failed('Enregistrement'));
  };

  const submitVet = (body: VeterinarianInput) => {
    const editing = vetSheet?.vet;
    const call = editing
      ? updateVet({ farmId: selectedFarmId, id: editing.id, body })
      : createVet({ farmId: selectedFarmId, body });
    call
      .unwrap()
      .then(() => setVetSheet(null))
      .catch(failed('Enregistrement'));
  };

  /** Only custom entries can be edited or removed — the platform catalog is shared. */
  const catalogRow = (entry: Vaccine | Treatment, kind: 'vaccine' | 'treatment') => (
    <View key={entry.key} style={styles.row}>
      <View style={styles.rowText}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.rowTitle}>{entry.label || humanizeKey(entry.key)}</Text>
          {entry.custom && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>Perso</Text>
            </View>
          )}
        </View>
        <Text style={styles.muted}>
          {kind === 'vaccine'
            ? [(entry as Vaccine).disease, routeLabel((entry as Vaccine).route ?? '')]
                .filter(Boolean)
                .join(' · ') || 'Aucun détail renseigné'
            : `${(entry as Treatment).molecule || 'Molécule non renseignée'} · délai ${
                (entry as Treatment).withdrawalDaysEggs ?? '?'
              } j œufs / ${(entry as Treatment).withdrawalDaysMeat ?? '?'} j viande`}
        </Text>
      </View>

      {canManage && entry.custom && (
        <View style={styles.rowActions}>
          <Pressable
            onPress={() => setCatalogSheet({ kind, entry })}
            accessibilityRole="button"
            accessibilityLabel={`Modifier ${entry.label}`}
            hitSlop={8}
            style={styles.iconBtn}
          >
            <Pencil size={18} color={tokens.colors.field.textMuted} />
          </Pressable>
          <Pressable
            onPress={() =>
              confirmCatalogDelete(entry.label, () => {
                const remove = kind === 'vaccine' ? deleteVaccine : deleteTreatment;
                remove({ farmId: selectedFarmId, key: entry.key })
                  .unwrap()
                  .catch(failed('Suppression'));
              })
            }
            accessibilityRole="button"
            accessibilityLabel={`Retirer ${entry.label}`}
            hitSlop={8}
            style={styles.iconBtn}
          >
            <Trash2 size={18} color={tokens.colors.error} />
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Bibliothèque sanitaire</Text>
          <Text style={styles.subtitle}>Vaccins, traitements, programmes et vétérinaires</Text>
        </View>
      </View>

      <View style={styles.chips}>
        {SECTIONS.map((s) => {
          const active = s.key === section;
          return (
            <Pressable
              key={s.key}
              onPress={() => setSection(s.key)}
              accessibilityRole="button"
              accessibilityLabel={s.label}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {section === 'vaccins' &&
          (vaccines.length === 0 ? (
            <Text style={styles.muted}>Aucun vaccin dans la bibliothèque.</Text>
          ) : (
            vaccines.map((v) => catalogRow(v, 'vaccine'))
          ))}

        {section === 'traitements' &&
          (treatments.length === 0 ? (
            <Text style={styles.muted}>Aucun traitement dans la bibliothèque.</Text>
          ) : (
            treatments.map((t) => catalogRow(t, 'treatment'))
          ))}

        {section === 'programmes' && (
          <>
            <Text style={styles.muted}>
              Programmes de la plateforme, en lecture seule. Ils s&apos;assignent à un lot depuis
              son onglet Sanitaire.
            </Text>
            {programs.map((p) => (
              <View key={p.key} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{p.label}</Text>
                  <Text style={styles.muted}>
                    {p.schedule
                      .map((s) => `${ageLabel(s.ageValue, s.ageUnit)} ${humanizeKey(s.vaccineKey)}`)
                      .join(' · ')}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        {section === 'veterinaires' &&
          (veterinarians.filter((v) => v.active).length === 0 ? (
            <Text style={styles.muted}>
              Aucun vétérinaire enregistré. L&apos;annuaire sert à joindre quelqu&apos;un depuis le
              poulailler, et à nommer les visites.
            </Text>
          ) : (
            veterinarians
              .filter((v) => v.active)
              .map((vet) => (
                <View key={vet.id} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{vet.fullName}</Text>
                    <View style={styles.vetMeta}>
                      {vet.phone ? <Phone size={14} color={tokens.colors.field.textMuted} /> : null}
                      <Text style={styles.muted}>
                        {[vet.phone, vet.speciality, vet.location].filter(Boolean).join(' · ') ||
                          'Aucun contact renseigné'}
                      </Text>
                    </View>
                  </View>
                  {canManage && (
                    <View style={styles.rowActions}>
                      <Pressable
                        onPress={() => setVetSheet({ vet })}
                        accessibilityRole="button"
                        accessibilityLabel={`Modifier ${vet.fullName}`}
                        hitSlop={8}
                        style={styles.iconBtn}
                      >
                        <Pencil size={18} color={tokens.colors.field.textMuted} />
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          confirmVeterinarianRemoval(vet.fullName, () => {
                            deactivateVet({ farmId: selectedFarmId, id: vet.id })
                              .unwrap()
                              .catch(failed('Suppression'));
                          })
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Retirer ${vet.fullName}`}
                        hitSlop={8}
                        style={styles.iconBtn}
                      >
                        <Trash2 size={18} color={tokens.colors.error} />
                      </Pressable>
                    </View>
                  )}
                </View>
              ))
          ))}
      </ScrollView>

      {canManage && section !== 'programmes' && (
        <ActionBar>
          <TouchableOpacity
            onPress={() =>
              section === 'veterinaires'
                ? setVetSheet({ vet: null })
                : setCatalogSheet({
                    kind: section === 'vaccins' ? 'vaccine' : 'treatment',
                    entry: null,
                  })
            }
            accessibilityRole="button"
            accessibilityLabel={
              section === 'vaccins'
                ? 'Nouveau vaccin'
                : section === 'traitements'
                  ? 'Nouveau traitement'
                  : 'Nouveau vétérinaire'
            }
            style={styles.add}
          >
            <Plus size={20} color={tokens.colors.action.commit.fg} />
            <Text style={styles.addText}>
              {section === 'vaccins'
                ? 'Nouveau vaccin'
                : section === 'traitements'
                  ? 'Nouveau traitement'
                  : 'Nouveau vétérinaire'}
            </Text>
          </TouchableOpacity>
        </ActionBar>
      )}

      <HealthCatalogSheet
        open={catalogSheet !== null}
        kind={catalogSheet?.kind ?? 'vaccine'}
        entry={catalogSheet?.entry ?? null}
        existingKeys={existingKeys}
        saving={savingVaccine || savingTreatment}
        onClose={() => setCatalogSheet(null)}
        onSubmit={submitCatalog}
      />

      <VeterinarianSheet
        open={vetSheet !== null}
        vet={vetSheet?.vet ?? null}
        saving={creatingVet || updatingVet}
        onClose={() => setVetSheet(null)}
        onSubmit={submitVet}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.layout.screenPadding,
    paddingVertical: tokens.spacing[3],
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: tokens.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.neutral[0],
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
  },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing[2],
    paddingHorizontal: tokens.layout.screenPadding,
    paddingBottom: tokens.spacing[3],
  },
  chip: {
    minHeight: tokens.touch.min,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[4],
    borderRadius: tokens.radii.full,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    backgroundColor: tokens.colors.neutral[0],
  },
  chipActive: {
    backgroundColor: tokens.colors.action.accumulate.bg,
    borderColor: tokens.colors.action.accumulate.border,
  },
  chipText: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  chipTextActive: { color: tokens.colors.action.accumulate.fg, fontFamily: fontFamily.sansSemiBold },
  content: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingBottom: tokens.spacing[8],
    gap: tokens.spacing[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing[3],
    backgroundColor: tokens.colors.field.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.field.ruleSubtle,
    padding: tokens.spacing[4],
  },
  rowText: { flex: 1, gap: 4 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  rowTitle: { ...tokens.typography.bodyLg, color: tokens.colors.field.text },
  muted: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, lineHeight: 18 },
  vetMeta: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[1] },
  tag: {
    paddingHorizontal: tokens.spacing[2],
    paddingVertical: 2,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.primary[50],
  },
  tagText: { ...tokens.typography.bodySm, fontSize: 11, color: tokens.colors.primary[700] },
  rowActions: { flexDirection: 'row', gap: tokens.spacing[2] },
  iconBtn: { minWidth: tokens.touch.min, minHeight: tokens.touch.min, alignItems: 'center', justifyContent: 'center' },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[2],
    minHeight: tokens.touch.cta,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.action.commit.bg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.commit.border,
  },
  addText: { ...tokens.typography.button, color: tokens.colors.action.commit.fg },
});
