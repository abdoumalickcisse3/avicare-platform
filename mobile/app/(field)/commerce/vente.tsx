/**
 * Vente directe — mobile port of the web `QuickSaleDialog`. Pick farm
 * production (broiler lots / œufs) into a cart, set quantity + unit price,
 * choose a client (walk-in by default), a payment method and an optional
 * circuit, then POST a single `createSale`. Online-only; OWNER/MANAGER only
 * (mirrors the backend WRITE_MANAGER gate). Bold polish lands in a later task.
 */
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft, Check, ChevronDown, Drumstick, Egg, Minus, Plus, Trash2 } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useProductionAvailability } from '@/commerce/useProductionAvailability';
import { useCreateSaleMutation } from '@/store/api/salesApi';
import { useCreateInvoiceFromSaleMutation } from '@/store/api/invoicesApi';
import { useGetClientsQuery } from '@/store/api/clientsApi';
import { useGetCatalogQuery } from '@/store/api/catalogApi';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from '@/lib/commercial';
import { formatCurrency } from '@/lib/format';
import type { ArticleSource, PaymentMethod, ProductType, Sale, SaleInput } from '@/types';

const WALK_IN = '__walk_in__';

interface Line {
  /** Unique cart key: "prod:BROILER:{unitId}" | "prod:EGGS". */
  key: string;
  articleKey: string;
  articleSource: ArticleSource;
  productType?: ProductType;
  productionUnitId?: number;
  label: string;
  unit: string;
  quantity: number;
  unitPriceXof: number;
  /** Soft front guard (the backend is the real oversell guard, D27). */
  max?: number;
}

/** Map the cart to the backend `SaleInput` (exported for the unit test). */
export function buildSaleInput(
  lines: Line[],
  clientId: string,
  method: PaymentMethod,
  channel: string,
): SaleInput {
  return {
    clientId: clientId === WALK_IN ? null : Number(clientId),
    paymentMethod: method,
    salesChannelKey: channel || undefined,
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

export default function VenteScreen() {
  const router = useRouter();
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { farmRole, session } = useFarmAccess();

  const { broilerLots, eggsAvailable, loading } = useProductionAvailability(selectedFarmId);
  const { data: clients } = useGetClientsQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId },
  );
  const { data: channels } = useGetCatalogQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId, category: 'sales_channels' },
  );
  const [createSale, { isLoading: saving }] = useCreateSaleMutation();
  const [createInvoiceFromSale] = useCreateInvoiceFromSaleMutation();

  const [lines, setLines] = useState<Line[]>([]);
  const [clientId, setClientId] = useState<string>(WALK_IN);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [channel, setChannel] = useState<string>('');

  const selectedClientLabel =
    clientId === WALK_IN
      ? 'Client de passage'
      : (clients?.find((c) => String(c.id) === clientId)?.displayName ?? 'Client');

  const total = lines.reduce((s, l) => s + l.quantity * l.unitPriceXof, 0);
  const hasOverMax = lines.some((l) => l.max != null && l.quantity > l.max);
  const hasProduction = broilerLots.length > 0 || eggsAvailable > 0;

  const addBroilerLot = (unitId: number, label: string, heads: number) => {
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
        {
          key,
          articleKey: 'BROILER',
          articleSource: 'PRODUCTION',
          productType: 'BROILER',
          productionUnitId: unitId,
          label,
          unit: 'tête',
          quantity: 1,
          unitPriceXof: 0,
          max: heads,
        },
      ];
    });
  };

  const addEggs = () => {
    const key = 'prod:EGGS';
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
        {
          key,
          articleKey: 'EGGS',
          articleSource: 'PRODUCTION',
          productType: 'EGGS',
          label: 'Œufs (plateaux)',
          unit: 'plateau',
          quantity: 1,
          unitPriceXof: 0,
          max: eggsAvailable,
        },
      ];
    });
  };

  const setQty = (key: string, qty: number) =>
    setLines((cur) =>
      qty <= 0 ? cur.filter((l) => l.key !== key) : cur.map((l) => (l.key === key ? { ...l, quantity: qty } : l)),
    );
  const setPrice = (key: string, price: number) =>
    setLines((cur) => cur.map((l) => (l.key === key ? { ...l, unitPriceXof: price } : l)));

  const submit = async () => {
    if (selectedFarmId === null || lines.length === 0) return;
    try {
      const sale = await createSale({
        farmId: selectedFarmId,
        body: buildSaleInput(lines, clientId, method, channel),
      }).unwrap();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Offer to turn the sale into an invoice right away (web createInvoiceFromSale).
      Alert.alert(
        'Vente enregistrée',
        `Total ${formatCurrency(total)}. Créer une facture pour cette vente ?`,
        [
          { text: 'Plus tard', style: 'cancel', onPress: () => router.replace('/(field)/commerce/ventes') },
          { text: 'Créer la facture', onPress: () => makeInvoice(sale) },
        ],
      );
    } catch (err) {
      const message =
        (err as { data?: { detail?: string; message?: string } })?.data?.detail ??
        (err as { data?: { message?: string } })?.data?.message ??
        'La vente n’a pas pu être enregistrée. Réessayez.';
      Alert.alert('Vente', message);
    }
  };

  const makeInvoice = async (sale: Sale) => {
    if (selectedFarmId === null) return;
    try {
      await createInvoiceFromSale({ farmId: selectedFarmId, saleId: sale.id }).unwrap();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Named client → their fiche shows the new invoice + encours; walk-in → Ventes.
      if (clientId !== WALK_IN) {
        router.replace(`/(field)/commerce/client/${Number(clientId)}`);
      } else {
        router.replace('/(field)/commerce/ventes');
      }
    } catch {
      Alert.alert('Facture', "La facture n’a pas pu être créée. La vente est bien enregistrée.");
      router.replace('/(field)/commerce/ventes');
    }
  };

  // Hooks above run unconditionally; guards below only after every hook ran.
  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }
  // Only bounce once the session is loaded and the role is truly insufficient —
  // farmRole is undefined while the token is still being read (async), and we
  // must not flash-redirect an authorized OWNER/MANAGER during that window.
  if (session && farmRole !== 'OWNER' && farmRole !== 'MANAGER') {
    return <Redirect href="/(field)/(tabs)/commerce" />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={8}
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Vente directe</Text>
          <Text style={styles.subtitle}>Vendez la production de la ferme</Text>
        </View>
      </View>

      {/* Client selector (select) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choisir le client"
        onPress={() => setClientPickerOpen(true)}
        style={styles.selectField}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.selectLabel}>Client</Text>
          <Text style={styles.selectValue} numberOfLines={1}>
            {selectedClientLabel}
          </Text>
        </View>
        <ChevronDown size={18} color={tokens.colors.field.textMuted} />
      </Pressable>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {loading && <Text style={styles.muted}>Chargement de la production…</Text>}
        {!loading && !hasProduction && (
          <Text style={styles.muted}>
            Aucune production à vendre pour le moment. Créez un lot de volaille ou enregistrez du
            stock d’œufs (plateaux).
          </Text>
        )}

        {hasProduction && (
          <>
            <Text style={styles.overline}>Production de la ferme</Text>
            <View style={styles.pickerGrid}>
              {broilerLots.map((lot, i) => (
                <Animated.View
                  key={lot.unitId}
                  entering={FadeInDown.delay(i * 40).springify()}
                  style={styles.pickerCardWrap}
                >
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      addBroilerLot(lot.unitId, lot.label, lot.heads);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Ajouter ${lot.label} à la vente`}
                    style={styles.pickerCard}
                  >
                    <LinearGradient
                      colors={[tokens.colors.accent[100], tokens.colors.neutral[0]]}
                      style={StyleSheet.absoluteFill}
                    />
                    <Drumstick size={20} color={tokens.colors.accent[600]} />
                    <Text style={styles.pickerLabel}>{lot.label}</Text>
                    <Text style={styles.pickerMeta}>{lot.heads} têtes</Text>
                  </Pressable>
                </Animated.View>
              ))}
              {eggsAvailable > 0 && (
                <Animated.View
                  entering={FadeInDown.delay(broilerLots.length * 40).springify()}
                  style={styles.pickerCardWrap}
                >
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      addEggs();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Ajouter Œufs à la vente"
                    style={styles.pickerCard}
                  >
                    <LinearGradient
                      colors={[tokens.colors.primary[100], tokens.colors.neutral[0]]}
                      style={StyleSheet.absoluteFill}
                    />
                    <Egg size={20} color={tokens.colors.primary[600]} />
                    <Text style={styles.pickerLabel}>Œufs</Text>
                    <Text style={styles.pickerMeta}>{eggsAvailable} plateaux</Text>
                  </Pressable>
                </Animated.View>
              )}
            </View>
          </>
        )}

        {lines.length > 0 && (
          <View style={styles.cart}>
            {lines.map((l) => (
              <Animated.View key={l.key} entering={FadeInDown.springify()} style={styles.cartRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cartLabel}>{l.label}</Text>
                  <Text style={styles.cartUnit}>{l.unit}</Text>
                  {l.max != null && l.quantity > l.max && (
                    <Text style={styles.overMax}>Dépasse le disponible ({l.max})</Text>
                  )}
                </View>
                <View style={styles.stepper}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Diminuer ${l.label}`}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setQty(l.key, l.quantity - 1);
                    }}
                    style={styles.stepBtn}
                  >
                    <Minus size={16} color={tokens.colors.primary[700]} />
                  </Pressable>
                  <Text style={styles.qty}>{l.quantity}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Augmenter ${l.label}`}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setQty(l.key, l.quantity + 1);
                    }}
                    style={styles.stepBtn}
                  >
                    <Plus size={16} color={tokens.colors.primary[700]} />
                  </Pressable>
                </View>
                <TextInput
                  value={String(l.unitPriceXof)}
                  onChangeText={(t) => setPrice(l.key, Number(t.replace(/[^0-9]/g, '')) || 0)}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  accessibilityLabel={`Prix unitaire ${l.label}`}
                  style={styles.priceInput}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Retirer ${l.label}`}
                  onPress={() => setQty(l.key, 0)}
                  style={styles.removeBtn}
                >
                  <Trash2 size={16} color={tokens.colors.error} />
                </Pressable>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Sticky frosted footer */}
      <BlurView intensity={30} tint="light" style={styles.footer}>
        <View style={styles.methodRow}>
          {PAYMENT_METHOD_OPTIONS.map((m) => (
            <Chip key={m} label={PAYMENT_METHOD_LABELS[m]} active={method === m} onPress={() => setMethod(m)} />
          ))}
        </View>
        {(channels ?? []).length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.methodRow}>
            <Chip label="Sans circuit" active={channel === ''} onPress={() => setChannel('')} />
            {(channels ?? []).map((c) => (
              <Chip
                key={c.key}
                label={String((c.value as { label?: string }).label ?? c.key)}
                active={channel === c.key}
                onPress={() => setChannel(c.key)}
              />
            ))}
          </ScrollView>
        )}
        <View style={styles.totalRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.totalCaption}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Valider la vente"
            onPress={submit}
            disabled={lines.length === 0 || saving || hasOverMax}
            style={[styles.commit, (lines.length === 0 || saving || hasOverMax) && styles.commitDisabled]}
          >
            <LinearGradient
              colors={[tokens.colors.accent[300], tokens.colors.accent[500]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.commitLabel}>Valider la vente</Text>
          </Pressable>
        </View>
      </BlurView>

      {/* Client picker */}
      <Modal
        visible={clientPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setClientPickerOpen(false)}
      >
        <Pressable style={styles.pickerBackdrop} accessibilityLabel="Fermer" onPress={() => setClientPickerOpen(false)} />
        <View style={styles.pickerSheet}>
          <Text style={styles.pickerTitle}>Choisir le client</Text>
          <ScrollView style={{ maxHeight: 380 }}>
            <ClientOption
              label="Client de passage"
              active={clientId === WALK_IN}
              onPress={() => {
                setClientId(WALK_IN);
                setClientPickerOpen(false);
              }}
            />
            {(clients ?? []).map((c) => (
              <ClientOption
                key={c.id}
                label={c.displayName}
                active={clientId === String(c.id)}
                onPress={() => {
                  setClientId(String(c.id));
                  setClientPickerOpen(false);
                }}
              />
            ))}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ClientOption({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.optionRow}
    >
      <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{label}</Text>
      {active && <Check size={18} color={tokens.colors.primary[600]} />}
    </Pressable>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
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

  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    marginHorizontal: tokens.layout.screenPadding,
    marginBottom: tokens.spacing[2],
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
    minHeight: 52,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[300],
    backgroundColor: tokens.colors.neutral[0],
  },
  selectLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  selectValue: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(18,43,18,0.35)' },
  pickerSheet: {
    backgroundColor: tokens.colors.neutral[0],
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    padding: tokens.layout.screenPadding,
    paddingBottom: tokens.spacing[8],
    gap: tokens.spacing[2],
  },
  pickerTitle: { ...tokens.typography.headingMd, color: tokens.colors.field.text, marginBottom: tokens.spacing[1] },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.neutral[100],
  },
  optionLabel: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  optionLabelActive: { fontWeight: '700', color: tokens.colors.primary[700] },

  content: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[2],
    paddingBottom: tokens.spacing[8],
    gap: tokens.spacing[3],
  },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
  overline: { ...tokens.typography.bodySm, color: tokens.colors.neutral[500], textTransform: 'uppercase' },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  pickerCardWrap: { width: '31%', minWidth: 100 },
  pickerCard: {
    gap: 4,
    padding: tokens.spacing[3],
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[0],
    overflow: 'hidden',
  },
  pickerLabel: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  pickerMeta: { ...tokens.typography.bodySm, color: tokens.colors.neutral[500] },

  cart: { gap: tokens.spacing[2], marginTop: tokens.spacing[2] },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    paddingVertical: tokens.spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.neutral[100],
  },
  cartLabel: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  cartUnit: { ...tokens.typography.bodySm, color: tokens.colors.neutral[500] },
  overMax: { ...tokens.typography.bodySm, color: tokens.colors.error },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: tokens.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary[50],
  },
  qty: { ...tokens.typography.bodyMd, minWidth: 22, textAlign: 'center', fontVariant: ['tabular-nums'] },
  priceInput: {
    width: 78,
    height: 36,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[300],
    paddingHorizontal: 8,
    textAlign: 'right',
    color: tokens.colors.field.text,
    fontVariant: ['tabular-nums'],
  },
  removeBtn: { padding: 6 },

  footer: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[3],
    paddingBottom: tokens.spacing[4],
    borderTopWidth: tokens.layout.ruleWidth,
    borderTopColor: tokens.colors.neutral[200],
    backgroundColor: 'rgba(255,255,255,0.75)',
    gap: tokens.spacing[2],
  },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], marginTop: tokens.spacing[1] },
  totalCaption: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  totalValue: { ...tokens.typography.displayMd, color: tokens.colors.primary[600], fontVariant: ['tabular-nums'] },
  commit: {
    minHeight: tokens.touch.primaryButton,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.accent[400],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[6],
    overflow: 'hidden',
  },
  commitDisabled: { opacity: 0.4 },
  commitLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.primary[900] },

  chip: {
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
    borderRadius: tokens.radii.full,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[300],
    backgroundColor: tokens.colors.neutral[0],
  },
  chipActive: { backgroundColor: tokens.colors.primary[600], borderColor: tokens.colors.primary[600] },
  chipLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.text },
  chipLabelActive: { color: tokens.colors.neutral[0], fontWeight: '600' },
});
