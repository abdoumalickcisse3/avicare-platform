/**
 * Créer une commande — mobile port of the web `OrderDialog`. Same production
 * cart as the direct sale, but for a client ORDER: a client is REQUIRED (no
 * walk-in), with an optional expected delivery date and address. Online-only;
 * OWNER/MANAGER/FARMER can create orders (WRITE_FARMER). POSTs `createOrder`.
 */
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft, Check, ChevronDown, Drumstick, Egg, Minus, Plus, Trash2 } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useProductionAvailability } from '@/commerce/useProductionAvailability';
import { useCreateOrderMutation } from '@/store/api/ordersApi';
import { useGetClientsQuery } from '@/store/api/clientsApi';
import { formatCurrency } from '@/lib/format';
import type { ArticleSource, OrderInput, ProductType } from '@/types';

interface Line {
  key: string;
  articleKey: string;
  articleSource: ArticleSource;
  productType?: ProductType;
  productionUnitId?: number;
  label: string;
  unit: string;
  quantity: number;
  unitPriceXof: number;
  max?: number;
}

export function buildOrderInput(
  lines: Line[],
  clientId: number,
  expectedDeliveryDate: string,
  deliveryAddress: string,
): OrderInput {
  return {
    clientId,
    expectedDeliveryDate: expectedDeliveryDate || undefined,
    deliveryAddress: deliveryAddress || undefined,
    lines: lines.map((l) => ({
      articleKey: l.articleKey,
      articleSource: l.articleSource,
      quantity: l.quantity,
      unitPriceXof: l.unitPriceXof,
      ...(l.articleSource === 'PRODUCTION'
        ? { productType: l.productType, productionUnitId: l.productionUnitId }
        : {}),
    })),
  };
}

export default function CommandeNouvelleScreen() {
  const router = useRouter();
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { farmRole, session } = useFarmAccess();
  const canCreate = farmRole === 'OWNER' || farmRole === 'MANAGER' || farmRole === 'FARMER';

  const { broilerLots, eggsAvailable, loading } = useProductionAvailability(selectedFarmId);
  const { data: clients } = useGetClientsQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId },
  );
  const [createOrder, { isLoading: saving }] = useCreateOrderMutation();

  const [lines, setLines] = useState<Line[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [expectedDate, setExpectedDate] = useState('');
  const [address, setAddress] = useState('');

  const total = lines.reduce((s, l) => s + l.quantity * l.unitPriceXof, 0);
  const hasOverMax = lines.some((l) => l.max != null && l.quantity > l.max);
  const hasProduction = broilerLots.length > 0 || eggsAvailable > 0;
  const selectedClientLabel =
    clientId == null ? 'Choisir un client' : (clients?.find((c) => c.id === clientId)?.displayName ?? 'Client');

  const addBroilerLot = (unitId: number, label: string, heads: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const key = `prod:BROILER:${unitId}`;
    setLines((cur) => {
      const i = cur.findIndex((l) => l.key === key);
      if (i >= 0) {
        const prev = cur[i]!;
        const next = [...cur];
        next[i] = { ...prev, quantity: prev.quantity + 1 };
        return next;
      }
      return [
        ...cur,
        { key, articleKey: 'BROILER', articleSource: 'PRODUCTION', productType: 'BROILER', productionUnitId: unitId, label, unit: 'tête', quantity: 1, unitPriceXof: 0, max: heads },
      ];
    });
  };
  const addEggs = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const key = 'prod:EGGS';
    setLines((cur) => {
      const i = cur.findIndex((l) => l.key === key);
      if (i >= 0) {
        const prev = cur[i]!;
        const next = [...cur];
        next[i] = { ...prev, quantity: prev.quantity + 1 };
        return next;
      }
      return [...cur, { key, articleKey: 'EGGS', articleSource: 'PRODUCTION', productType: 'EGGS', label: 'Œufs (plateaux)', unit: 'plateau', quantity: 1, unitPriceXof: 0, max: eggsAvailable }];
    });
  };
  const setQty = (key: string, qty: number) =>
    setLines((cur) => (qty <= 0 ? cur.filter((l) => l.key !== key) : cur.map((l) => (l.key === key ? { ...l, quantity: qty } : l))));
  const setPrice = (key: string, price: number) =>
    setLines((cur) => cur.map((l) => (l.key === key ? { ...l, unitPriceXof: price } : l)));

  const submit = async () => {
    if (selectedFarmId === null || clientId == null || lines.length === 0) return;
    try {
      await createOrder({ farmId: selectedFarmId, body: buildOrderInput(lines, clientId, expectedDate, address) }).unwrap();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(field)/commerce/commandes');
    } catch (err) {
      const message =
        (err as { data?: { detail?: string; message?: string } })?.data?.detail ??
        (err as { data?: { message?: string } })?.data?.message ??
        'La commande n’a pas pu être créée. Réessayez.';
      Alert.alert('Commande', message);
    }
  };

  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }
  if (session && !canCreate) {
    return <Redirect href="/(field)/(tabs)/commerce" />;
  }

  const disabled = clientId == null || lines.length === 0 || saving || hasOverMax;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={8} style={styles.backBtn}>
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Nouvelle commande</Text>
          <Text style={styles.subtitle}>Commande client à livrer</Text>
        </View>
      </View>

      {/* Client (required) */}
      <Pressable accessibilityRole="button" accessibilityLabel="Choisir le client" onPress={() => setClientPickerOpen(true)} style={[styles.selectField, clientId == null && styles.selectFieldEmpty]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.selectLabel}>Client *</Text>
          <Text style={[styles.selectValue, clientId == null && styles.selectPlaceholder]} numberOfLines={1}>{selectedClientLabel}</Text>
        </View>
        <ChevronDown size={18} color={tokens.colors.field.textMuted} />
      </Pressable>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {loading && <Text style={styles.muted}>Chargement de la production…</Text>}
        {!loading && !hasProduction && <Text style={styles.muted}>Aucune production à commander pour le moment.</Text>}

        {hasProduction && (
          <>
            <Text style={styles.overline}>Production de la ferme</Text>
            <View style={styles.pickerGrid}>
              {broilerLots.map((lot) => (
                <Pressable key={lot.unitId} onPress={() => addBroilerLot(lot.unitId, lot.label, lot.heads)} accessibilityRole="button" accessibilityLabel={`Ajouter ${lot.label} à la commande`} style={styles.pickerCard}>
                  <Drumstick size={20} color={tokens.colors.accent[600]} />
                  <Text style={styles.pickerLabel}>{lot.label}</Text>
                  <Text style={styles.pickerMeta}>{lot.heads} têtes</Text>
                </Pressable>
              ))}
              {eggsAvailable > 0 && (
                <Pressable onPress={addEggs} accessibilityRole="button" accessibilityLabel="Ajouter Œufs à la commande" style={styles.pickerCard}>
                  <Egg size={20} color={tokens.colors.primary[600]} />
                  <Text style={styles.pickerLabel}>Œufs</Text>
                  <Text style={styles.pickerMeta}>{eggsAvailable} plateaux</Text>
                </Pressable>
              )}
            </View>
          </>
        )}

        {lines.length > 0 && (
          <View style={styles.cart}>
            {lines.map((l) => (
              <View key={l.key} style={styles.cartRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cartLabel}>{l.label}</Text>
                  <Text style={styles.cartUnit}>{l.unit}</Text>
                  {l.max != null && l.quantity > l.max && <Text style={styles.overMax}>Dépasse le disponible ({l.max})</Text>}
                </View>
                <View style={styles.stepper}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Diminuer ${l.label}`} onPress={() => setQty(l.key, l.quantity - 1)} style={styles.stepBtn}>
                    <Minus size={16} color={tokens.colors.primary[700]} />
                  </Pressable>
                  <Text style={styles.qty}>{l.quantity}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Augmenter ${l.label}`} onPress={() => setQty(l.key, l.quantity + 1)} style={styles.stepBtn}>
                    <Plus size={16} color={tokens.colors.primary[700]} />
                  </Pressable>
                </View>
                <TextInput value={String(l.unitPriceXof)} onChangeText={(t) => setPrice(l.key, Number(t.replace(/[^0-9]/g, '')) || 0)} keyboardType="number-pad" inputMode="numeric" accessibilityLabel={`Prix unitaire ${l.label}`} style={styles.priceInput} />
                <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${l.label}`} onPress={() => setQty(l.key, 0)} style={styles.removeBtn}>
                  <Trash2 size={16} color={tokens.colors.error} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.fieldLabel}>Livraison prévue (AAAA-MM-JJ)</Text>
        <TextInput value={expectedDate} onChangeText={setExpectedDate} placeholder="2026-08-10" accessibilityLabel="Date de livraison prévue" style={styles.textField} />
        <Text style={styles.fieldLabel}>Adresse de livraison</Text>
        <TextInput value={address} onChangeText={setAddress} placeholder="Optionnel" accessibilityLabel="Adresse de livraison" style={styles.textField} />
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.totalCaption}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Valider la commande" onPress={submit} disabled={disabled} style={[styles.commit, disabled && styles.commitDisabled]}>
            <Text style={styles.commitLabel}>Valider la commande</Text>
          </Pressable>
        </View>
      </View>

      {/* Client picker */}
      <Modal visible={clientPickerOpen} transparent animationType="slide" onRequestClose={() => setClientPickerOpen(false)}>
        <Pressable style={styles.pickerBackdrop} accessibilityLabel="Fermer" onPress={() => setClientPickerOpen(false)} />
        <View style={styles.pickerSheet}>
          <Text style={styles.pickerTitle}>Choisir le client</Text>
          <ScrollView style={{ maxHeight: 380 }}>
            {(clients ?? []).map((c) => (
              <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={c.displayName} onPress={() => { setClientId(c.id); setClientPickerOpen(false); }} style={styles.optionRow}>
                <Text style={[styles.optionLabel, clientId === c.id && styles.optionLabelActive]}>{c.displayName}</Text>
                {clientId === c.id && <Check size={18} color={tokens.colors.primary[600]} />}
              </Pressable>
            ))}
            {(clients ?? []).length === 0 && <Text style={styles.muted}>Aucun client. Ajoutez-en depuis le web.</Text>}
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
  overMax: { ...tokens.typography.bodySm, color: tokens.colors.error },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: { width: 32, height: 32, borderRadius: tokens.radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.primary[50] },
  qty: { ...tokens.typography.bodyMd, minWidth: 22, textAlign: 'center', fontVariant: ['tabular-nums'] },
  priceInput: { width: 78, height: 36, borderRadius: tokens.radii.md, borderWidth: 1, borderColor: tokens.colors.neutral[300], paddingHorizontal: 8, textAlign: 'right', color: tokens.colors.field.text, fontVariant: ['tabular-nums'] },
  removeBtn: { padding: 6 },

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
