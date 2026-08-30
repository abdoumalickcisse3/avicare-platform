/**
 * Réglages — a single settings category, mirroring the web
 * `reglages/[category]`. For the four declarative catalog categories (Stock,
 * Lots, Ventes, Comptabilité) it renders the reusable `ManagedCatalogList`
 * (keep/add/remove over the seeded catalog — same `catalogApi` as the web
 * `CatalogManager`). Sanitaire is bespoke on the web (custom vaccines &
 * treatments); the mobile catalog API is read-only, so it shows the library and
 * defers custom edits to the web. Catalog edits are OWNER / MANAGER.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft, Syringe } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { getCategoryConfig } from '@/constants/catalogCategories';
import { ManagedCatalogList } from '@/components/onboarding/ManagedCatalogList';
import { useGetTreatmentCatalogQuery, useGetVaccinesQuery } from '@/store/api/healthApi';
import { humanizeKey } from '@/lib/health';

const CATEGORY_NAMES: Record<string, string> = {
  stock: 'Stock',
  lots: 'Lots',
  sanitaire: 'Sanitaire',
  ventes: 'Ventes',
  comptabilite: 'Comptabilité',
};


export default function ReglagesCategoryScreen() {
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category: string }>();
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { isAdmin, can, session } = useFarmAccess();

  const slug = String(category ?? '');
  const config = getCategoryConfig(slug);
  const name = config?.title ?? CATEGORY_NAMES[slug] ?? slug;

  if (selectedFarmId === null) return <Redirect href="/(field)" />;
  // Token loads async — only enforce the guard once `session` resolves.
  if (session && !isAdmin && !can('settings:read')) return <Redirect href="/(field)" />;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={8} style={styles.backBtn}>
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{name}</Text>
          <Text style={styles.subtitle}>Réglages · {name}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* `sanitaire` never reaches here: `reglages/sanitaire.tsx` is a static route and Expo
            Router resolves it before this `[category]` sibling. The read-only library that used
            to live here has been replaced by that screen, which can also edit. */}
        {config ? (
          <ManagedCatalogList farmId={selectedFarmId} config={config} />
        ) : (
          <Text style={styles.muted}>Cette catégorie arrivera dans une prochaine version.</Text>
        )}
      </ScrollView>
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
    paddingTop: tokens.spacing[3],
    paddingBottom: tokens.spacing[2],
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
  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[16] },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[6] },

  note: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], backgroundColor: tokens.colors.primary[50], borderRadius: tokens.radii.lg, padding: tokens.spacing[3] },
  noteText: { ...tokens.typography.bodySm, color: tokens.colors.primary[700], flex: 1 },
  section: { gap: tokens.spacing[2] },
  sectionTitle: { ...tokens.typography.headingMd, fontSize: 15, color: tokens.colors.field.text },
  rows: { gap: tokens.spacing[2] },
  row: {
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[3],
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[0],
  },
  rowLabel: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
});
