/**
 * Souches — déclare une souche absente du catalogue (Goliath, Kuroiler, "locale améliorée"...),
 * mirrors the web's `BreedDialog` + `BreedLibraryView` combined into one screen.
 *
 * Gardé par le RÔLE, pas par une permission : le backend (`FarmBreedController`) garde
 * `@farmAccess.hasRole(#farmId, OWNER, MANAGER)`, donc cet écran redirige quiconque n'est pas
 * OWNER/MANAGER plutôt que d'afficher un formulaire qui prendrait un 403 au clic — même garde
 * que `achat-nouveau.tsx` (écriture réservée au propriétaire et au gérant).
 *
 * On n'envoie jamais de `code` ni de `species` : le backend calcule le code (slugify) depuis le
 * nom, et un slugify client divergent a jadis créé deux entrées de catalogue pour un même
 * produit (PR #491) ; `species` défaut à POULTRY côté serveur (V1 ne sert que la volaille).
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft, Bird } from 'lucide-react-native';
import { fontFamily, tokens } from '@/theme';
import { useFarmAccess } from '@/auth/useSession';
import { canManageFarm } from '@/auth/roles';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useDeclareBreedMutation, useListBreedsQuery, type Breed, type BreedProfile } from '@/store/api/breedsApi';
import { apiErrorMessage } from '@/lib/apiError';

/** French labels for the four production profiles — the backend catalogue's own vocabulary
 *  (`breed_profiles`, migration V69), never invented here. */
const PROFILES: { value: BreedProfile; label: string }[] = [
  { value: 'BROILER_FAST', label: 'Chair à croissance rapide' },
  { value: 'BROILER_RUSTIC', label: 'Chair rustique (croissance lente)' },
  { value: 'LAYER_INDUSTRIAL', label: 'Ponte industrielle' },
  { value: 'LAYER_RUSTIC', label: 'Ponte rustique (locale améliorée)' },
];

function profileLabel(profile: BreedProfile | null): string {
  return PROFILES.find((p) => p.value === profile)?.label ?? 'Profil non renseigné';
}

/** Never invents a number: a breed with no declared default shows that honestly. */
function targetLine(breed: Breed): string {
  if (breed.defaultTargetWeightG == null || breed.defaultTargetAgeDays == null) {
    return 'Pas de référence de croissance';
  }
  return `${breed.defaultTargetWeightG} g à ${breed.defaultTargetAgeDays} j`;
}

export default function SouchesScreen() {
  const router = useRouter();
  const farmId = useSelector(selectSelectedFarmId);
  const { farmRole, isAdmin, session } = useFarmAccess();
  const canWrite = canManageFarm(farmRole, isAdmin);

  const { data: breeds = [] } = useListBreedsQuery(farmId === null ? skipToken : 'POULTRY');
  const [declareBreed, { isLoading }] = useDeclareBreedMutation();

  const [name, setName] = useState('');
  const [profile, setProfile] = useState<BreedProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const ownBreeds = breeds.filter((b) => b.farmId === farmId);
  const valid = name.trim().length > 0 && profile != null;

  if (farmId === null) return <Redirect href="/(field)" />;
  // Token loads async — only enforce the guard once `session` resolves, else it flash-redirects
  // before permissions are known (same pattern as `reglages/index.tsx`).
  if (session && !canWrite) return <Redirect href="/(field)/reglages" />;

  async function submit() {
    if (!valid || profile == null || farmId === null) return;
    setError(null);
    setConfirmation(null);
    const declaredName = name.trim();
    try {
      await declareBreed({ farmId, body: { name: declaredName, profile } }).unwrap();
      setName('');
      setProfile(null);
      setConfirmation(`« ${declaredName} » est désormais disponible pour vos lots.`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Déclaration impossible. Vérifiez votre connexion et réessayez.'));
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => router.back()} style={styles.back}>
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </Pressable>
        <Text style={styles.topTitle}>Souches</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Souches propres à votre ferme</Text>
          <Text style={styles.sectionHint}>
            Les souches absentes du catalogue (Goliath, Kuroiler, locale améliorée…) déclarées
            ci-dessous rejoignent le sélecteur de création de lot.
          </Text>
          {ownBreeds.length === 0 ? (
            <Text style={styles.muted}>Aucune souche propre à cette ferme pour l&apos;instant.</Text>
          ) : (
            ownBreeds.map((b) => (
              <View key={b.id} style={styles.row}>
                <Text style={styles.rowTitle}>{b.name}</Text>
                <Text style={styles.rowMeta}>{profileLabel(b.profile)}</Text>
                <Text style={styles.rowMeta}>{targetLine(b)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Déclarer une souche</Text>
          <Text style={styles.sectionHint}>
            Indiquez son nom et le profil le plus proche : il détermine les cibles par défaut, et
            si une courbe de croissance de référence peut être tracée.
          </Text>

          <Text style={styles.label}>Nom de la souche</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ex. Goliath"
            accessibilityLabel="Nom de la souche"
            style={styles.input}
          />

          <Text style={styles.label}>Profil</Text>
          <View style={styles.chips}>
            {PROFILES.map((p) => {
              const on = profile === p.value;
              return (
                <Pressable
                  key={p.value}
                  onPress={() => setProfile(p.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={p.label}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{p.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {confirmation ? <Text style={styles.confirmation}>{confirmation}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={submit}
            disabled={!valid || isLoading}
            accessibilityRole="button"
            accessibilityLabel="Déclarer la souche"
            style={[styles.cta, (!valid || isLoading) && styles.ctaDisabled]}
          >
            <Bird size={18} color={tokens.colors.action.commit.fg} />
            <Text style={styles.ctaText}>{isLoading ? 'Déclaration…' : 'Déclarer la souche'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    paddingHorizontal: tokens.spacing[2],
    paddingVertical: tokens.spacing[2],
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { ...tokens.typography.headingMd, color: tokens.colors.field.text, flex: 1 },
  content: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingBottom: tokens.spacing[16],
    gap: tokens.spacing[4],
  },
  section: {
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    backgroundColor: tokens.colors.neutral[0],
    padding: tokens.spacing[4],
    gap: tokens.spacing[3],
  },
  sectionTitle: {
    ...tokens.typography.bodyMd,
    fontFamily: fontFamily.sansSemiBold,
    color: tokens.colors.field.text,
  },
  sectionHint: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, lineHeight: 18 },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
  row: {
    borderRadius: tokens.radii.md,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.ruleSubtle,
    padding: tokens.spacing[3],
    gap: 2,
  },
  rowTitle: { ...tokens.typography.bodyLg, color: tokens.colors.field.text },
  rowMeta: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  label: { ...tokens.typography.bodySm, fontWeight: '600', color: tokens.colors.field.text },
  input: {
    ...tokens.typography.bodyLg,
    color: tokens.colors.field.text,
    minHeight: tokens.touch.field,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.neutral[300],
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing[3],
    backgroundColor: tokens.colors.neutral[0],
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  chip: {
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[2],
    borderRadius: tokens.radii.full,
    borderWidth: 1.5,
    borderColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[0],
  },
  chipOn: { borderColor: tokens.colors.primary[500], backgroundColor: tokens.colors.primary[50] },
  chipText: { ...tokens.typography.bodyMd, color: tokens.colors.neutral[700] },
  chipTextOn: { color: tokens.colors.primary[700], fontFamily: fontFamily.sansSemiBold },
  confirmation: { ...tokens.typography.bodySm, color: tokens.colors.primary[700] },
  error: { ...tokens.typography.bodySm, color: tokens.colors.error },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[2],
    minHeight: tokens.touch.primaryButton,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.action.commit.bg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.commit.border,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { ...tokens.typography.button, color: tokens.colors.action.commit.fg },
});
