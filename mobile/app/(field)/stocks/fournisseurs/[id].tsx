/**
 * Fournisseur detail — the supplier current account (compte-courant), mirroring the web
 * `/stocks/fournisseurs/[id]`: balance in words, the statement, a sheet to record a payment, and
 * the standing "Prévenir par WhatsApp" switch. OWNER/MANAGER only (mirrors the backend gate).
 *
 * The switch exists here — not just at creation on the list screen — so a phone-only farmer can
 * revoke consent, not just grant it: the create sheet in `fournisseurs.tsx` has no edit
 * counterpart, and a switch that can only be turned on is a trap.
 *
 * Recording a payment is an ordinary online mutation, never queued: `@/sync/types` — money
 * writes stay online because the server doesn't deduplicate them, and here a replayed payment
 * would also send the supplier a second WhatsApp receipt for the same one.
 */
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useGetSupplierQuery, useUpdateSupplierMutation } from '@/store/api/suppliersApi';
import { useGetSupplierLedgerQuery, useRecordSupplierPaymentMutation } from '@/store/api/supplierLedgerApi';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from '@/lib/commercial';
import { formatCurrency } from '@/lib/format';
import type { PaymentMethod, SupplierLedgerEntry } from '@/types';

const todayIso = () => new Date().toISOString().slice(0, 10);

/** What a balance says, in words rather than a sign (mirrors the web `balanceLabel`). */
function balanceLabel(balanceXof: number): string {
  if (balanceXof > 0) return `Vous devez ${formatCurrency(balanceXof)}`;
  if (balanceXof < 0) return `Avance de ${formatCurrency(-balanceXof)}`;
  return 'Compte soldé';
}

export default function FournisseurDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const supplierId = rawId ? Number(rawId) : NaN;

  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { farmRole } = useFarmAccess();
  const canWrite = farmRole === 'OWNER' || farmRole === 'MANAGER';

  const { data: supplier } = useGetSupplierQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId, id: supplierId },
  );
  const { data: statement, isLoading } = useGetSupplierLedgerQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId, supplierId },
  );
  const [updateSupplier, { isLoading: updatingNotify }] = useUpdateSupplierMutation();

  const [sheetOpen, setSheetOpen] = useState(false);

  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }

  /**
   * A full-replacement PUT: every field the supplier already has is resent, only
   * `notifyWhatsapp` changes. Omitting a field here would silently erase it (`SupplierInput`
   * comment in `suppliersApi.ts`) — this is why the phone can grant WhatsApp consent but, without
   * this, could never revoke it.
   */
  const toggleNotify = async (value: boolean) => {
    if (!supplier) return;
    try {
      await updateSupplier({
        farmId: selectedFarmId,
        id: supplierId,
        body: {
          commercialName: supplier.commercialName,
          contactPerson: supplier.contactPerson ?? undefined,
          phone: supplier.phone ?? undefined,
          email: supplier.email ?? undefined,
          address: supplier.address ?? undefined,
          city: supplier.city ?? undefined,
          types: supplier.types ?? [],
          paymentTerms: supplier.paymentTerms ?? undefined,
          notes: supplier.notes ?? undefined,
          notifyWhatsapp: value,
        },
      }).unwrap();
    } catch {
      Alert.alert('Fournisseur', "Le réglage n’a pas pu être mis à jour. Réessayez.");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={8} style={styles.backBtn}>
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{supplier?.commercialName ?? 'Fournisseur'}</Text>
          <Text style={styles.subtitle}>{isLoading ? '…' : balanceLabel(statement?.balanceXof ?? 0)}</Text>
        </View>
      </View>

      {canWrite && supplier && (
        <View style={styles.notifyRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Prévenir par WhatsApp</Text>
            {!supplier.phone && (
              <Text style={styles.helper}>Renseignez un téléphone pour activer les avis.</Text>
            )}
          </View>
          <Switch
            value={Boolean(supplier.notifyWhatsapp)}
            onValueChange={toggleNotify}
            disabled={!supplier.phone || updatingNotify}
            accessibilityLabel="Prévenir par WhatsApp"
          />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {!statement?.entries.length ? (
          <Text style={styles.muted}>Aucun mouvement avec ce fournisseur.</Text>
        ) : (
          <View style={styles.list}>
            {statement.entries.map((e) => (
              <EntryRow key={e.id} entry={e} />
            ))}
          </View>
        )}
      </ScrollView>

      {canWrite && (
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enregistrer un paiement"
            onPress={() => setSheetOpen(true)}
            style={styles.commit}
          >
            <Text style={styles.commitLabel}>Enregistrer un paiement</Text>
          </Pressable>
        </View>
      )}

      <PaymentSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        farmId={selectedFarmId}
        supplierId={supplierId}
        supplierName={supplier?.commercialName}
        canNotify={Boolean(supplier?.notifyWhatsapp)}
      />
    </SafeAreaView>
  );
}

function EntryRow({ entry }: { entry: SupplierLedgerEntry }) {
  const isCredit = entry.direction === 'CREDIT';
  return (
    <View style={styles.entryRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.entryLabel}>{entry.label ?? (isCredit ? 'Paiement' : 'Dette')}</Text>
        <Text style={styles.entryDate}>{entry.entryDate}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.entryAmount, { color: isCredit ? tokens.colors.success : tokens.colors.error }]}>
          {isCredit ? '−' : '+'} {formatCurrency(entry.amountXof)}
        </Text>
        <Text style={styles.entryBalance}>{formatCurrency(entry.runningBalanceXof)}</Text>
      </View>
    </View>
  );
}

/**
 * Records a payment (CREDIT) against the ledger — online-only, deliberately never queued (see
 * file header). The WhatsApp checkbox only appears when the supplier's standing switch is on;
 * a second, per-payment gate, sent as `notifySupplier`.
 */
function PaymentSheet({
  open,
  onClose,
  farmId,
  supplierId,
  supplierName,
  canNotify,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  supplierId: number;
  supplierName: string | undefined;
  canNotify: boolean;
}) {
  const [recordPayment, { isLoading }] = useRecordSupplierPaymentMutation();
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [notifySupplier, setNotifySupplier] = useState(true);

  const value = amount ? Number(amount) : NaN;
  const canSubmit = Number.isFinite(value) && value > 0 && !isLoading;

  const close = () => {
    setAmount('');
    setLabel('');
    setMethod('CASH');
    setReference('');
    setNotifySupplier(true);
    onClose();
  };

  const submit = async () => {
    if (!Number.isFinite(value) || value <= 0) return;
    try {
      await recordPayment({
        farmId,
        supplierId,
        body: {
          amountXof: value,
          entryDate: todayIso(),
          label: label.trim() || undefined,
          method,
          reference: reference.trim() || undefined,
          // Always explicit: omitted, the server reads it as true.
          notifySupplier: canNotify && notifySupplier,
        },
      }).unwrap();
      close();
    } catch {
      Alert.alert('Paiement', "Le paiement n’a pas pu être enregistré. Réessayez.");
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} accessibilityLabel="Fermer" onPress={close} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>Enregistrer un paiement</Text>
        {supplierName && <Text style={styles.sheetSubtitle}>{supplierName}</Text>}

        <Text style={styles.fieldLabel}>Montant *</Text>
        <TextInput
          value={amount}
          onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="0"
          accessibilityLabel="Montant"
          style={styles.input}
        />

        <Text style={styles.fieldLabel}>Libellé</Text>
        <TextInput value={label} onChangeText={setLabel} placeholder="Optionnel" accessibilityLabel="Libellé" style={styles.input} />

        <Text style={styles.fieldLabel}>Mode de paiement</Text>
        <View style={styles.chipRow}>
          {PAYMENT_METHOD_OPTIONS.map((m) => (
            <Chip key={m} label={PAYMENT_METHOD_LABELS[m]} active={method === m} onPress={() => setMethod(m)} />
          ))}
        </View>

        <Text style={styles.fieldLabel}>Référence</Text>
        <TextInput value={reference} onChangeText={setReference} placeholder="Optionnel" accessibilityLabel="Référence" style={styles.input} />

        {canNotify && (
          <View style={styles.switchRow}>
            <Text style={[styles.fieldLabel, { marginTop: 0, flex: 1 }]}>
              {supplierName ? `Prévenir ${supplierName} par WhatsApp` : 'Prévenir par WhatsApp'}
            </Text>
            <Switch
              value={notifySupplier}
              onValueChange={setNotifySupplier}
              accessibilityLabel={supplierName ? `Prévenir ${supplierName} par WhatsApp` : 'Prévenir par WhatsApp'}
            />
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Confirmer le paiement"
          onPress={submit}
          disabled={!canSubmit}
          style={[styles.commit, !canSubmit && styles.commitDisabled]}
        >
          <Text style={styles.commitLabel}>Enregistrer</Text>
        </Pressable>
      </View>
    </Modal>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[3], paddingBottom: tokens.spacing[2] },
  backBtn: { width: 40, height: 40, borderRadius: tokens.radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200] },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodySm, fontWeight: '600', color: tokens.colors.field.textMuted, marginTop: 2 },

  notifyRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], paddingHorizontal: tokens.layout.screenPadding, paddingBottom: tokens.spacing[3] },

  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[8] },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[8] },
  list: { gap: tokens.spacing[2] },
  entryRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.colors.neutral[0], borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.neutral[200], padding: tokens.spacing[3] },
  entryLabel: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  entryDate: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },
  entryAmount: { ...tokens.typography.bodyMd, fontWeight: '700', fontVariant: ['tabular-nums'] },
  entryBalance: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, fontVariant: ['tabular-nums'], marginTop: 2 },

  footer: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[3], paddingBottom: tokens.spacing[4], borderTopWidth: tokens.layout.ruleWidth, borderTopColor: tokens.colors.neutral[200], backgroundColor: tokens.colors.neutral[0] },

  backdrop: { flex: 1, backgroundColor: 'rgba(18,43,18,0.35)' },
  sheet: { backgroundColor: tokens.colors.neutral[0], borderTopLeftRadius: tokens.radii.xl, borderTopRightRadius: tokens.radii.xl, padding: tokens.layout.screenPadding, paddingBottom: tokens.spacing[8], gap: tokens.spacing[2] },
  sheetTitle: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  sheetSubtitle: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginBottom: tokens.spacing[1] },
  fieldLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[2] },
  helper: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },
  input: { minHeight: 46, borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.neutral[300], paddingHorizontal: tokens.spacing[3], color: tokens.colors.field.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  chip: { paddingHorizontal: tokens.spacing[3], paddingVertical: tokens.spacing[2], borderRadius: tokens.radii.full, borderWidth: 1, borderColor: tokens.colors.neutral[300], backgroundColor: tokens.colors.neutral[0] },
  chipActive: { backgroundColor: tokens.colors.primary[600], borderColor: tokens.colors.primary[600] },
  chipLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.text },
  chipLabelActive: { color: tokens.colors.neutral[0], fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], marginTop: tokens.spacing[3] },
  commit: { minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.accent[400], alignItems: 'center', justifyContent: 'center', marginTop: tokens.spacing[3] },
  commitDisabled: { opacity: 0.4 },
  commitLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.primary[900] },
});
