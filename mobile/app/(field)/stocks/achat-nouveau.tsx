/**
 * Bon d'achat — création, et correction d'un brouillon. Port mobile du web
 * `PurchaseOrderDialog`. On choisit un fournisseur (obligatoire), on ajoute des articles du
 * stock avec quantité et prix unitaire, une date de livraison prévue facultative → DRAFT.
 *
 * Avec `?id=<n>`, l'écran ouvre ce brouillon et le réécrit au lieu d'en créer un. Le brouillon
 * existe pour être revu avant d'être envoyé, et le backend l'accepte tant qu'il est DRAFT
 * (`PurchaseOrderService.updateDraft`) — sans quoi une quantité mal tapée obligeait à annuler le
 * bon et à tout ressaisir.
 *
 * En ligne seulement. Écritures réservées au propriétaire et au gérant : le backend garde sur le
 * RÔLE (`InventoryAccess.WRITE_MANAGER`), pas sur la permission — un membre à qui l'on aurait
 * accordé `inventory:write` à la main prendrait un 403.
 */
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft, Check, ChevronDown, Minus, Package, Plus, Trash2 } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useGetSuppliersQuery } from '@/store/api/suppliersApi';
import { useGetStockItemsQuery } from '@/store/api/inventoryStockApi';
import {
  useCreatePurchaseOrderMutation,
  useGetPurchaseOrderQuery,
  useUpdatePurchaseOrderMutation,
} from '@/store/api/purchaseOrdersApi';
import { formatCurrency } from '@/lib/format';
import type { ArticleSource, PurchaseOrderInput } from '@/types';

function articleLabel(key: string): string {
  const s = key.replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface Line {
  articleKey: string;
  articleSource: ArticleSource;
  label: string;
  unit: string;
  quantity: number;
  unitPriceXof: number;
}

export function buildPurchaseOrderInput(lines: Line[], supplierId: number, expectedDate: string): PurchaseOrderInput {
  return {
    supplierId,
    expectedDeliveryDate: expectedDate || undefined,
    lines: lines.map((l) => ({
      articleKey: l.articleKey,
      articleSource: l.articleSource,
      orderedQuantity: l.quantity,
      unitPriceXof: l.unitPriceXof,
    })),
  };
}

export default function AchatNouveauScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const editingId = rawId ? Number(rawId) : null;

  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { farmRole, isAdmin, session } = useFarmAccess();
  const canWrite = isAdmin || farmRole === 'OWNER' || farmRole === 'MANAGER';

  const arg = selectedFarmId === null ? skipToken : { farmId: selectedFarmId };
  const { data: suppliers } = useGetSuppliersQuery(arg);
  const { data: items } = useGetStockItemsQuery(arg);
  const [createPO, { isLoading: creating }] = useCreatePurchaseOrderMutation();
  const [updatePO, { isLoading: updating }] = useUpdatePurchaseOrderMutation();
  const saving = creating || updating;

  const { data: existing } = useGetPurchaseOrderQuery(
    selectedFarmId === null || editingId === null
      ? skipToken
      : { farmId: selectedFarmId, id: editingId },
  );

  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [expectedDate, setExpectedDate] = useState('');

  /**
   * Recharge le brouillon dans le formulaire, une fois qu'il est arrivé.
   *
   * Clé sur `existing.id` et non sur l'objet : le cache RTK renvoie une nouvelle référence à
   * chaque invalidation, et se recaler dessus effacerait ce que l'utilisateur est en train de
   * taper. Le libellé et l'unité viennent du catalogue quand l'article y est encore ; sinon on
   * garde le libellé figé sur le bon, qui reste lisible.
   */
  useEffect(() => {
    if (!existing) return;
    setSupplierId(existing.supplierId);
    setExpectedDate(existing.expectedDeliveryDate ?? '');
    setLines(
      existing.items.map((it) => {
        const item = (items ?? []).find((i) => i.articleKey === it.articleKey);
        return {
          articleKey: it.articleKey,
          articleSource: it.articleSource,
          label: it.articleLabelSnapshot ?? articleLabel(it.articleKey),
          unit: it.unit ?? item?.unit ?? 'unité',
          quantity: it.orderedQuantity,
          unitPriceXof: it.unitPriceXof,
        };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const total = lines.reduce((s, l) => s + l.quantity * l.unitPriceXof, 0);
  const supplierLabel = supplierId == null ? 'Choisir un fournisseur' : (suppliers?.find((s) => s.id === supplierId)?.commercialName ?? 'Fournisseur');

  const addArticle = (articleKey: string, articleSource: ArticleSource, unit: string, price: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLines((cur) => {
      if (cur.some((l) => l.articleKey === articleKey)) return cur;
      return [...cur, { articleKey, articleSource, label: articleLabel(articleKey), unit, quantity: 1, unitPriceXof: price }];
    });
  };
  const setQty = (key: string, qty: number) =>
    setLines((cur) => (qty <= 0 ? cur.filter((l) => l.articleKey !== key) : cur.map((l) => (l.articleKey === key ? { ...l, quantity: qty } : l))));
  const setPrice = (key: string, price: number) =>
    setLines((cur) => cur.map((l) => (l.articleKey === key ? { ...l, unitPriceXof: price } : l)));

  const submit = async () => {
    if (selectedFarmId === null || supplierId == null || lines.length === 0) return;
    try {
      const body = buildPurchaseOrderInput(lines, supplierId, expectedDate);
      if (editingId !== null) {
        await updatePO({ farmId: selectedFarmId, id: editingId, body }).unwrap();
      } else {
        await createPO({ farmId: selectedFarmId, body }).unwrap();
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Après une correction on revient sur la fiche du bon, pas sur la liste : c'est là que
      // l'on vérifie ce qu'on vient d'écrire, et que l'on décide de l'envoyer.
      router.replace(
        editingId !== null
          ? `/(field)/stocks/achats/${editingId}`
          : '/(field)/stocks/achats',
      );
    } catch (err) {
      const message =
        (err as { data?: { detail?: string; message?: string } })?.data?.detail ??
        (err as { data?: { message?: string } })?.data?.message ??
        (editingId !== null
          ? 'Le brouillon n’a pas pu être corrigé. Réessayez.'
          : 'Le bon d’achat n’a pas pu être créé. Réessayez.');
      Alert.alert('Bon d’achat', message);
    }
  };

  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }
  if (session && !canWrite) {
    return <Redirect href="/(field)/(tabs)/stocks" />;
  }

  const disabled = supplierId == null || lines.length === 0 || saving;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={8} style={styles.backBtn}>
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {editingId !== null ? 'Corriger le brouillon' : "Nouveau bon d'achat"}
          </Text>
          <Text style={styles.subtitle}>
            {editingId !== null
              ? 'Les lignes remplacent celles du brouillon'
              : 'Commander du stock à un fournisseur'}
          </Text>
        </View>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Choisir le fournisseur" onPress={() => setSupplierPickerOpen(true)} style={[styles.selectField, supplierId == null && styles.selectFieldEmpty]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.selectLabel}>Fournisseur *</Text>
          <Text style={[styles.selectValue, supplierId == null && styles.selectPlaceholder]} numberOfLines={1}>{supplierLabel}</Text>
        </View>
        <ChevronDown size={18} color={tokens.colors.field.textMuted} />
      </Pressable>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.overline}>Articles à commander</Text>
        {(items ?? []).filter((i) => i.active).length === 0 ? (
          <Text style={styles.muted}>Aucun article en stock. Ajoutez-en depuis le web.</Text>
        ) : (
          <View style={styles.pickerGrid}>
            {(items ?? []).filter((i) => i.active).map((i) => (
              <Pressable
                key={i.id}
                onPress={() => addArticle(i.articleKey, i.articleSource, i.unit ?? 'unité', i.typicalUnitPriceXof ?? 0)}
                accessibilityRole="button"
                accessibilityLabel={`Ajouter ${articleLabel(i.articleKey)}`}
                style={styles.pickerCard}
              >
                <Package size={18} color={tokens.colors.primary[600]} />
                <Text style={styles.pickerLabel} numberOfLines={1}>{articleLabel(i.articleKey)}</Text>
                <Text style={styles.pickerMeta}>{i.unit ?? ''}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {lines.length > 0 && (
          <View style={styles.cart}>
            {lines.map((l) => (
              <View key={l.articleKey} style={styles.cartRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cartLabel}>{l.label}</Text>
                  <Text style={styles.cartUnit}>{l.unit}</Text>
                </View>
                <View style={styles.stepper}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Diminuer ${l.label}`} onPress={() => setQty(l.articleKey, l.quantity - 1)} style={styles.stepBtn}>
                    <Minus size={16} color={tokens.colors.primary[700]} />
                  </Pressable>
                  <TextInput value={String(l.quantity)} onChangeText={(t) => setQty(l.articleKey, Number(t.replace(/[^0-9]/g, '')) || 0)} keyboardType="number-pad" inputMode="numeric" accessibilityLabel={`Quantité ${l.label}`} style={styles.qtyInput} />
                  <Pressable accessibilityRole="button" accessibilityLabel={`Augmenter ${l.label}`} onPress={() => setQty(l.articleKey, l.quantity + 1)} style={styles.stepBtn}>
                    <Plus size={16} color={tokens.colors.primary[700]} />
                  </Pressable>
                </View>
                <TextInput value={String(l.unitPriceXof)} onChangeText={(t) => setPrice(l.articleKey, Number(t.replace(/[^0-9]/g, '')) || 0)} keyboardType="number-pad" inputMode="numeric" accessibilityLabel={`Prix ${l.label}`} style={styles.priceInput} />
                <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${l.label}`} onPress={() => setQty(l.articleKey, 0)} style={styles.removeBtn}>
                  <Trash2 size={16} color={tokens.colors.error} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.fieldLabel}>Livraison prévue (AAAA-MM-JJ)</Text>
        <TextInput value={expectedDate} onChangeText={setExpectedDate} placeholder="2026-08-10" accessibilityLabel="Date de livraison prévue" style={styles.textField} />
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.totalCaption}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Valider le bon d'achat" onPress={submit} disabled={disabled} style={[styles.commit, disabled && styles.commitDisabled]}>
            <Text style={styles.commitLabel}>Valider le bon</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={supplierPickerOpen} transparent animationType="slide" onRequestClose={() => setSupplierPickerOpen(false)}>
        <Pressable style={styles.pickerBackdrop} accessibilityLabel="Fermer" onPress={() => setSupplierPickerOpen(false)} />
        <View style={styles.pickerSheet}>
          <Text style={styles.pickerTitle}>Choisir le fournisseur</Text>
          <ScrollView style={{ maxHeight: 380 }}>
            {(suppliers ?? []).map((s) => (
              <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={s.commercialName} onPress={() => { setSupplierId(s.id); setSupplierPickerOpen(false); }} style={styles.optionRow}>
                <Text style={[styles.optionLabel, supplierId === s.id && styles.optionLabelActive]}>{s.commercialName}</Text>
                {supplierId === s.id && <Check size={18} color={tokens.colors.primary[600]} />}
              </Pressable>
            ))}
            {(suppliers ?? []).length === 0 && <Text style={styles.muted}>Aucun fournisseur. Ajoutez-en d'abord.</Text>}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  header: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[3], paddingBottom: tokens.spacing[2] },
  backBtn: { width: 40, height: 40, borderRadius: tokens.radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200] },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },

  selectField: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], marginHorizontal: tokens.layout.screenPadding, marginBottom: tokens.spacing[2], paddingHorizontal: tokens.spacing[3], paddingVertical: tokens.spacing[2], minHeight: 52, borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.neutral[300], backgroundColor: tokens.colors.neutral[0] },
  selectFieldEmpty: { borderColor: tokens.colors.accent[400] },
  selectLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  selectValue: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  selectPlaceholder: { color: tokens.colors.field.textMuted, fontWeight: '400' },

  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[8], gap: tokens.spacing[3] },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
  overline: { ...tokens.typography.bodySm, color: tokens.colors.neutral[500], textTransform: 'uppercase' },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  pickerCard: { width: '31%', minWidth: 100, gap: 4, padding: tokens.spacing[3], borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.neutral[200], backgroundColor: tokens.colors.neutral[0] },
  pickerLabel: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  pickerMeta: { ...tokens.typography.bodySm, color: tokens.colors.neutral[500] },

  cart: { gap: tokens.spacing[2], marginTop: tokens.spacing[1] },
  cartRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], paddingVertical: tokens.spacing[2], borderBottomWidth: 1, borderBottomColor: tokens.colors.neutral[100] },
  cartLabel: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  cartUnit: { ...tokens.typography.bodySm, color: tokens.colors.neutral[500] },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: { width: 30, height: 30, borderRadius: tokens.radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.primary[50] },
  qtyInput: { width: 48, height: 34, borderRadius: tokens.radii.md, borderWidth: 1, borderColor: tokens.colors.neutral[300], textAlign: 'center', color: tokens.colors.field.text, fontVariant: ['tabular-nums'] },
  priceInput: { width: 70, height: 36, borderRadius: tokens.radii.md, borderWidth: 1, borderColor: tokens.colors.neutral[300], paddingHorizontal: 6, textAlign: 'right', color: tokens.colors.field.text, fontVariant: ['tabular-nums'] },
  removeBtn: { padding: 4 },

  fieldLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[2] },
  textField: { minHeight: 46, borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.neutral[300], paddingHorizontal: tokens.spacing[3], color: tokens.colors.field.text },

  footer: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[3], paddingBottom: tokens.spacing[4], borderTopWidth: tokens.layout.ruleWidth, borderTopColor: tokens.colors.neutral[200], backgroundColor: tokens.colors.neutral[0] },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3] },
  totalCaption: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  totalValue: { ...tokens.typography.displayMd, color: tokens.colors.primary[600], fontVariant: ['tabular-nums'] },
  commit: { minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.accent[400], alignItems: 'center', justifyContent: 'center', paddingHorizontal: tokens.spacing[6] },
  commitDisabled: { opacity: 0.4 },
  commitLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.primary[900] },

  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(18,43,18,0.35)' },
  pickerSheet: { backgroundColor: tokens.colors.neutral[0], borderTopLeftRadius: tokens.radii.xl, borderTopRightRadius: tokens.radii.xl, padding: tokens.layout.screenPadding, paddingBottom: tokens.spacing[8], gap: tokens.spacing[2] },
  pickerTitle: { ...tokens.typography.headingMd, color: tokens.colors.field.text, marginBottom: tokens.spacing[1] },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: tokens.spacing[3], borderBottomWidth: 1, borderBottomColor: tokens.colors.neutral[100] },
  optionLabel: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  optionLabelActive: { fontWeight: '700', color: tokens.colors.primary[700] },
});
