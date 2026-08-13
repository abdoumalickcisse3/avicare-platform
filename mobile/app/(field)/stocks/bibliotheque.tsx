/**
 * Bibliothèque des articles — mobile port of the web `/stocks/articles`
 * (`inventoryCatalogApi.getInventoryArticles`): the platform ∪ custom catalog of
 * stockable articles, with a subcategory filter, source labels, a "Perso" badge
 * and the typical unit price. Custom articles can be added (bottom sheet) and
 * removed; platform articles are read-only — same rules as the web. Writes need
 * `inventory:write` (OWNER / MANAGER).
 */
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft, BookOpen, Check, Plus, X } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import {
  useCreateArticleMutation,
  useDeleteArticleMutation,
  useGetInventoryArticlesQuery,
} from '@/store/api/inventoryCatalogApi';
import { formatCurrency } from '@/lib/format';
import { ARTICLE_SOURCE_LABELS, INVENTORY_SUBCATEGORY_LABELS, subcategoryLabel } from '@/lib/inventory';
import type { InventoryCatalogItem } from '@/types';

const ALL = 'Tous';

const SUBCATEGORIES: { value: string; label: string }[] = Object.entries(INVENTORY_SUBCATEGORY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function BibliothequeScreen() {
  const router = useRouter();
  const { can } = useFarmAccess();
  const canWrite = can('inventory:write');
  const selectedFarmId = useSelector(selectSelectedFarmId);

  const { data: articles, isLoading } = useGetInventoryArticlesQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId },
  );
  const [createArticle, { isLoading: saving }] = useCreateArticleMutation();
  const [deleteArticle] = useDeleteArticleMutation();

  const [filter, setFilter] = useState(ALL);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [subcategory, setSubcategory] = useState('FEED');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');

  const categories = useMemo(() => {
    const set = new Set<string>();
    (articles ?? []).forEach((a) => a.subcategory && set.add(a.subcategory));
    return [ALL, ...Array.from(set).sort()];
  }, [articles]);

  const filtered = useMemo(
    () => (articles ?? []).filter((a) => filter === ALL || a.subcategory === filter),
    [articles, filter],
  );

  if (selectedFarmId === null) return <Redirect href="/(field)" />;

  const priceNum = /^\d+$/.test(price.trim()) ? Number(price.trim()) : NaN;
  const canSubmit = label.trim() !== '' && unit.trim() !== '';

  const openSheet = () => {
    setLabel('');
    setSubcategory('FEED');
    setUnit('');
    setPrice('');
    setSheetOpen(true);
  };

  const submit = async () => {
    if (!canSubmit) return;
    const value: Record<string, unknown> = { label: label.trim(), subcategory, unit: unit.trim() };
    if (Number.isInteger(priceNum) && priceNum > 0) value.typical_unit_price_xof = priceNum;
    try {
      await createArticle({ farmId: selectedFarmId, key: slugify(label.trim()), value }).unwrap();
      setSheetOpen(false);
    } catch {
      Alert.alert('Article', "L'article n'a pas pu être ajouté. Réessayez.");
    }
  };

  const confirmDelete = (a: InventoryCatalogItem) => {
    Alert.alert("Supprimer l'article", `Supprimer « ${a.label} » de la bibliothèque ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteArticle({ farmId: selectedFarmId, key: a.articleKey }).unwrap();
          } catch {
            Alert.alert('Article', 'La suppression a échoué. Réessayez.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={8} style={styles.backBtn}>
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Bibliothèque</Text>
          <Text style={styles.subtitle}>Catalogue des articles stockables</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {categories.map((c) => {
            const on = filter === c;
            return (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityLabel={`Filtrer ${c === ALL ? 'Tous' : subcategoryLabel(c)}`}
                onPress={() => setFilter(c)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>
                  {c === ALL ? ALL : subcategoryLabel(c)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <Text style={styles.muted}>Chargement…</Text>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyDisc}>
              <BookOpen size={28} color={tokens.colors.primary[600]} />
            </View>
            <Text style={styles.emptyText}>Aucun article</Text>
            <Text style={styles.emptySub}>Ajoutez un article personnalisé à votre bibliothèque.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((a) => (
              <View key={`${a.articleSource}-${a.articleKey}`} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>{a.label}</Text>
                      {a.custom && (
                        <View style={styles.persoBadge}>
                          <Text style={styles.persoText}>Perso</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.meta}>
                      {ARTICLE_SOURCE_LABELS[a.articleSource]}
                      {a.subcategory ? ` · ${subcategoryLabel(a.subcategory)}` : ''}
                      {a.unit ? ` · ${a.unit}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.price}>
                    {a.typicalUnitPriceXof != null ? formatCurrency(a.typicalUnitPriceXof) : '—'}
                  </Text>
                </View>
                {a.custom && canWrite && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Supprimer ${a.label}`}
                    onPress={() => confirmDelete(a)}
                    style={styles.deleteBtn}
                  >
                    <X size={14} color={tokens.colors.error} />
                    <Text style={styles.deleteLabel}>Supprimer</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {canWrite && (
        <Pressable accessibilityRole="button" accessibilityLabel="Nouvel article" onPress={openSheet} style={styles.fab}>
          <Plus size={24} color={tokens.colors.primary[900]} />
        </Pressable>
      )}

      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={styles.backdrop} accessibilityLabel="Fermer" onPress={() => setSheetOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Nouvel article</Text>

          <Text style={styles.fieldLabel}>Nom de l&apos;article</Text>
          <TextInput value={label} onChangeText={setLabel} placeholder="Ex. Maïs concassé" placeholderTextColor={tokens.colors.field.disabled} accessibilityLabel="Nom" style={styles.input} maxLength={80} />

          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.typeRow}>
            {SUBCATEGORIES.map((s) => {
              const on = subcategory === s.value;
              return (
                <Pressable
                  key={s.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={s.label}
                  onPress={() => setSubcategory(s.value)}
                  style={[styles.typeChip, on && styles.typeChipOn]}
                >
                  {on && <Check size={14} color={tokens.colors.neutral[0]} />}
                  <Text style={[styles.typeChipLabel, on && styles.typeChipLabelOn]}>{s.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Unité</Text>
              <TextInput value={unit} onChangeText={setUnit} placeholder="kg, sac, L…" placeholderTextColor={tokens.colors.field.disabled} accessibilityLabel="Unité" style={styles.input} maxLength={16} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Prix indicatif (XOF)</Text>
              <TextInput value={price} onChangeText={setPrice} keyboardType="number-pad" inputMode="numeric" placeholder="0" placeholderTextColor={tokens.colors.field.disabled} accessibilityLabel="Prix" style={styles.input} />
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enregistrer l'article"
            onPress={submit}
            disabled={!canSubmit || saving}
            style={[styles.commit, (!canSubmit || saving) && styles.commitDisabled]}
          >
            <Text style={styles.commitLabel}>Enregistrer</Text>
          </Pressable>
        </View>
      </Modal>
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

  filterRow: { paddingHorizontal: tokens.layout.screenPadding, paddingBottom: tokens.spacing[2] },
  chipRow: { gap: tokens.spacing[2], paddingVertical: 2 },
  chip: { paddingHorizontal: tokens.spacing[3], paddingVertical: tokens.spacing[2], borderRadius: tokens.radii.full, borderWidth: 1, borderColor: tokens.colors.neutral[300], backgroundColor: tokens.colors.neutral[0] },
  chipOn: { backgroundColor: tokens.colors.primary[600], borderColor: tokens.colors.primary[600] },
  chipLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.text },
  chipLabelOn: { color: tokens.colors.neutral[0], fontWeight: '600' },

  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[1], paddingBottom: tokens.spacing[16] },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[8] },
  emptyBox: { alignItems: 'center', gap: tokens.spacing[2], paddingVertical: tokens.spacing[10] },
  emptyDisc: { width: 60, height: 60, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.primary[50], alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  emptySub: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, textAlign: 'center', paddingHorizontal: tokens.spacing[6] },

  list: { gap: tokens.spacing[3] },
  card: { backgroundColor: tokens.colors.neutral[0], borderRadius: tokens.radii.xl, borderWidth: 1, borderColor: tokens.colors.neutral[200], padding: tokens.spacing[4], gap: tokens.spacing[2] },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: tokens.spacing[2] },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  name: { ...tokens.typography.bodyMd, fontWeight: '700', color: tokens.colors.field.text, flexShrink: 1 },
  persoBadge: { borderRadius: tokens.radii.full, borderWidth: 1, borderColor: tokens.colors.primary[300], paddingHorizontal: tokens.spacing[2], paddingVertical: 1 },
  persoText: { ...tokens.typography.bodySm, fontSize: 10, fontWeight: '700', color: tokens.colors.primary[700] },
  meta: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },
  price: { ...tokens.typography.numericSm, fontSize: 14, color: tokens.colors.primary[600] },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  deleteLabel: { ...tokens.typography.bodySm, color: tokens.colors.error, fontWeight: '600' },

  fab: {
    position: 'absolute',
    right: tokens.layout.screenPadding,
    bottom: tokens.spacing[6],
    width: 56,
    height: 56,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.accent[400],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: tokens.colors.primary[900],
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  backdrop: { flex: 1, backgroundColor: 'rgba(18,43,18,0.35)' },
  sheet: { backgroundColor: tokens.colors.neutral[0], borderTopLeftRadius: tokens.radii.xl, borderTopRightRadius: tokens.radii.xl, padding: tokens.layout.screenPadding, paddingBottom: tokens.spacing[8], gap: tokens.spacing[1] },
  sheetTitle: { ...tokens.typography.headingMd, color: tokens.colors.field.text, marginBottom: tokens.spacing[1] },
  fieldLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[2] },
  input: { minHeight: 46, borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.neutral[300], paddingHorizontal: tokens.spacing[3], color: tokens.colors.field.text, ...tokens.typography.bodyMd },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2], marginTop: tokens.spacing[1] },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: tokens.spacing[3], paddingVertical: tokens.spacing[2], borderRadius: tokens.radii.full, borderWidth: 1, borderColor: tokens.colors.neutral[300] },
  typeChipOn: { backgroundColor: tokens.colors.primary[600], borderColor: tokens.colors.primary[600] },
  typeChipLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.text },
  typeChipLabelOn: { color: tokens.colors.neutral[0], fontWeight: '600' },
  row: { flexDirection: 'row', gap: tokens.spacing[3] },
  commit: { minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.accent[400], alignItems: 'center', justifyContent: 'center', marginTop: tokens.spacing[4] },
  commitDisabled: { opacity: 0.4 },
  commitLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.primary[900] },
});
