/**
 * Client detail — the running account (compte courant) for one commercial
 * client: encours hero, credit standing, open invoices, the payment history, and the actions
 * OWNER/MANAGER hold — encaisser, modifier la fiche, annuler un paiement.
 *
 * The credit limit is shown but never enforced: the backend computes `overLimit` and exposes it
 * without ever blocking a sale on it (Décision D26). Turning it into a stop condition here would
 * invent a rule the platform deliberately does not have.
 */
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft, Pencil } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import {
  useDeactivateClientMutation,
  useGetClientCreditQuery,
  useGetClientQuery,
  useUpdateClientMutation,
} from '@/store/api/clientsApi';
import { useGetPaymentsQuery, useVoidPaymentMutation } from '@/store/api/paymentsApi';
import { ClientSheet } from '@/commerce/ClientSheet';
import { useGetInvoicesQuery } from '@/store/api/invoicesApi';
import { PaymentSheet } from '@/commerce/PaymentSheet';
import { CLIENT_TYPE_LABELS, creditColor, initials } from '@/lib/commercial';
import { formatCurrency } from '@/lib/format';
import type { Invoice } from '@/types';

const INVOICE_STATUS_LABELS: Record<string, string> = {
  ISSUED: 'Émise',
  PARTIALLY_PAID: 'Partielle',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
};

export default function ClientDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ clientId: string }>();
  const rawId = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId;
  const clientId = rawId ? Number(rawId) : NaN;

  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { farmRole } = useFarmAccess();
  const canCollect = farmRole === 'OWNER' || farmRole === 'MANAGER';

  // The detail call, not a find() in the list: an edit must round-trip fields the list omits.
  const { data: client } = useGetClientQuery(
    selectedFarmId === null || !Number.isFinite(clientId)
      ? skipToken
      : { farmId: selectedFarmId, id: clientId },
  );
  const { data: credit } = useGetClientCreditQuery(
    selectedFarmId === null || !Number.isFinite(clientId)
      ? skipToken
      : { farmId: selectedFarmId, id: clientId },
  );
  const { data: payments = [] } = useGetPaymentsQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId },
  );
  const { data: invoices, isLoading } = useGetInvoicesQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId, clientId },
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [updateClient, { isLoading: savingClient }] = useUpdateClientMutation();
  const [deactivateClient] = useDeactivateClientMutation();
  const [voidPayment] = useVoidPaymentMutation();

  const clientPayments = payments.filter((p) => p.clientId === clientId);
  const openInvoices: Invoice[] = (invoices ?? []).filter(
    (i) => i.status !== 'PAID' && i.status !== 'CANCELLED',
  );

  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }

  const balanceColor = client ? creditColor(client) : tokens.colors.neutral[400];
  const isDebtor = (client?.currentBalanceXof ?? 0) > 0;
  const heroTint = isDebtor ? tokens.colors.accent[50] : tokens.colors.primary[50];

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
          <Text style={styles.title} numberOfLines={1}>
            {client?.displayName ?? 'Client'}
          </Text>
          {client && <Text style={styles.subtitle}>{CLIENT_TYPE_LABELS[client.clientType]}</Text>}
        </View>
        {canCollect && client ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Modifier le client"
            onPress={() => setEditOpen(true)}
            hitSlop={8}
            style={styles.backBtn}
          >
            <Pencil size={20} color={tokens.colors.field.text} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Encours hero */}
        <LinearGradient
          colors={[heroTint, tokens.colors.neutral[0]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(client?.displayName ?? '') || '?'}</Text>
          </View>
          <Text style={styles.heroCaption}>Encours</Text>
          <Text style={[styles.heroValue, { color: balanceColor }]}>
            {formatCurrency(client?.currentBalanceXof ?? 0)}
          </Text>
        </LinearGradient>

        {credit?.creditLimitXof != null ? (
          <View style={[styles.creditRow, credit.overLimit && styles.creditRowOver]}>
            <Text style={styles.creditLabel}>
              Plafond {formatCurrency(credit.creditLimitXof)}
            </Text>
            <Text style={credit.overLimit ? styles.creditOver : styles.creditOk}>
              {credit.overLimit
                ? `Dépassé de ${credit.overLimitPercent ?? 0} %`
                : 'Dans la limite'}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Factures ouvertes</Text>
        {isLoading ? (
          <Text style={styles.muted}>Chargement…</Text>
        ) : openInvoices.length === 0 ? (
          <Text style={styles.muted}>Aucune facture ouverte.</Text>
        ) : (
          <View style={styles.invoiceList}>
            {openInvoices.map((inv, i) => (
              <Animated.View key={inv.id} entering={FadeInDown.delay(i * 40).springify()} style={styles.invoiceRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invoiceNumber}>{inv.invoiceNumber}</Text>
                  <Text style={styles.invoiceStatus}>
                    {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                  </Text>
                </View>
                <Text style={styles.invoiceAmount}>{formatCurrency(inv.outstandingXof)}</Text>
              </Animated.View>
            ))}
          </View>
        )}
        <Text style={styles.sectionTitle}>Paiements</Text>
        {clientPayments.length === 0 ? (
          <Text style={styles.muted}>Aucun paiement enregistré.</Text>
        ) : (
          <View style={styles.invoiceList}>
            {clientPayments.map((p) => (
              <View key={p.id} style={styles.invoiceRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invoiceNumber}>{formatCurrency(p.amountXof)}</Text>
                  <Text style={styles.invoiceStatus}>
                    {p.paymentDate}
                    {p.status === 'CANCELLED' ? ' · annulé' : ''}
                  </Text>
                </View>
                {canCollect && p.status !== 'CANCELLED' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Annuler le paiement de ${formatCurrency(p.amountXof)}`}
                    onPress={() =>
                      Alert.alert(
                        'Annuler ce paiement ?',
                        `Les ${formatCurrency(p.amountXof)} reviennent sur la facture et sur l'encours du client. Le paiement reste visible dans l'historique, marqué annulé.`,
                        [
                          { text: 'Retour', style: 'cancel' },
                          {
                            text: 'Annuler le paiement',
                            style: 'destructive',
                            onPress: () => {
                              if (selectedFarmId !== null) {
                                voidPayment({ farmId: selectedFarmId, id: p.id });
                              }
                            },
                          },
                        ],
                      )
                    }
                    style={styles.voidBtn}
                  >
                    <Text style={styles.voidText}>Annuler</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {canCollect && openInvoices.length > 0 && (
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Encaisser"
            onPress={() => setSheetOpen(true)}
            style={styles.commit}
          >
            <Text style={styles.commitLabel}>Encaisser</Text>
          </Pressable>
        </View>
      )}

      <ClientSheet
        open={editOpen}
        client={client ?? null}
        saving={savingClient}
        onClose={() => setEditOpen(false)}
        onSubmit={async (body) => {
          if (selectedFarmId === null) return;
          try {
            await updateClient({ farmId: selectedFarmId, id: clientId, body }).unwrap();
            setEditOpen(false);
          } catch {
            Alert.alert('Modification refusée', "La fiche n'a pas été enregistrée.");
          }
        }}
        onDeactivate={async () => {
          if (selectedFarmId === null) return;
          await deactivateClient({ farmId: selectedFarmId, id: clientId });
          setEditOpen(false);
          router.back();
        }}
      />

      {sheetOpen && (
        <PaymentSheet
          farmId={selectedFarmId}
          invoices={openInvoices}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onDone={() => setSheetOpen(false)}
        />
      )}
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

  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[8] },
  hero: {
    alignItems: 'center',
    gap: tokens.spacing[1],
    padding: tokens.spacing[5],
    borderRadius: tokens.radii.xl,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    marginBottom: tokens.spacing[5],
    overflow: 'hidden',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing[2],
  },
  avatarText: { ...tokens.typography.headingMd, color: tokens.colors.primary[700] },
  heroCaption: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  heroValue: { ...tokens.typography.displayMd, fontVariant: ['tabular-nums'] },

  sectionTitle: { ...tokens.typography.headingMd, color: tokens.colors.field.text, marginBottom: tokens.spacing[3] },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
  invoiceList: { gap: tokens.spacing[2] },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing[3],
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[0],
  },
  invoiceNumber: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  invoiceStatus: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  invoiceAmount: { ...tokens.typography.bodyMd, fontWeight: '700', color: tokens.colors.field.text, fontVariant: ['tabular-nums'] },

  footer: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[3],
    paddingBottom: tokens.spacing[4],
    borderTopWidth: tokens.layout.ruleWidth,
    borderTopColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[0],
  },
  commit: {
    minHeight: tokens.touch.primaryButton,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.accent[400],
    alignItems: 'center',
    justifyContent: 'center',
  },
  commitLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.primary[900] },
  creditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    backgroundColor: tokens.colors.neutral[0],
    padding: tokens.spacing[3],
    marginTop: tokens.spacing[3],
  },
  creditRowOver: {
    borderColor: tokens.colors.warningDark,
    backgroundColor: tokens.colors.warningLight,
  },
  creditLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  creditOk: { ...tokens.typography.bodySm, color: tokens.colors.successDark },
  creditOver: { ...tokens.typography.bodySm, color: tokens.colors.warningDark },
  voidBtn: {
    minHeight: tokens.touch.min,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[3],
  },
  voidText: { ...tokens.typography.bodySm, color: tokens.colors.errorDark },
});
