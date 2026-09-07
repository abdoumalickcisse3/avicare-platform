/**
 * Facture (invoice) detail — mirrors the web `/commercial/factures/[id]`: header
 * with number + status, client, amounts (total / encaissé / reste), due date and
 * line items. When the invoice still has a balance, OWNER/MANAGER can record a
 * payment against it (reuses the shared PaymentSheet), or cancel it.
 *
 * Cancelling writes off what the client still owed on this invoice — the backend removes the
 * outstanding amount from their running account (`clientService.adjustBalance`), so the
 * confirmation names that amount rather than saying "annuler". A PAID or already-CANCELLED
 * invoice is refused server-side (INVALID_INVOICE_TRANSITION), so the button is not offered.
 */
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ArrowLeft, Share2 } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useCancelInvoiceMutation, useGetInvoiceQuery } from '@/store/api/invoicesApi';
import { useListFarmsQuery } from '@/store/api/farmsApi';
import { invoiceHtml } from '@/commerce/invoiceHtml';
import { useGetClientsQuery } from '@/store/api/clientsApi';
import { PaymentSheet } from '@/commerce/PaymentSheet';
import { INVOICE_STATUS_LABELS, invoiceStatusColor } from '@/lib/commercial';
import { formatCurrency, formatNumber } from '@/lib/format';

export default function FactureDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const invoiceId = rawId ? Number(rawId) : NaN;

  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { farmRole } = useFarmAccess();
  const canCollect = farmRole === 'OWNER' || farmRole === 'MANAGER';

  const { data: invoice, isLoading } = useGetInvoiceQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId, id: invoiceId },
  );
  const { data: clients } = useGetClientsQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId },
  );

  const { data: farms } = useListFarmsQuery();
  const [cancelInvoice, { isLoading: cancelling }] = useCancelInvoiceMutation();
  const [sharing, setSharing] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);

  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }

  const clientName =
    invoice?.clientId == null
      ? 'Client de passage'
      : (clients?.find((c) => c.id === invoice?.clientId)?.displayName ?? 'Client');
  const canPay = canCollect && !!invoice && invoice.outstandingXof > 0;
  const client = clients?.find((c) => c.id === invoice?.clientId) ?? null;
  const farmName = farms?.find((f) => f.id === selectedFarmId)?.name ?? 'Ma ferme';

  /**
   * Sort la facture en PDF, puis ouvre la feuille de partage du téléphone : imprimer, envoyer par
   * WhatsApp, enregistrer. C'est ce que le web fait avec `/factures/{id}/imprimer` — sauf qu'ici
   * le fichier existe sur l'appareil, donc l'éleveur peut l'envoyer à son client sans réseau au
   * moment de l'envoi.
   *
   * Le partage n'est pas disponible partout (émulateur nu, restrictions) : on retombe alors sur
   * la boîte d'impression système, qui sait aussi enregistrer en PDF.
   */
  const sharePdf = async () => {
    if (!invoice || sharing) return;
    setSharing(true);
    try {
      const html = invoiceHtml({ invoice, client, farmName });
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Facture ${invoice.invoiceNumber}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Print.printAsync({ html });
      }
    } catch {
      Alert.alert('Facture', "Le PDF n'a pas pu être produit. Réessayez.");
    } finally {
      setSharing(false);
    }
  };
  // Mirrors the backend guard: only a live invoice with something left on it can be cancelled.
  const canCancel =
    canCollect && !!invoice && invoice.status !== 'CANCELLED' && invoice.status !== 'PAID';

  const doCancel = () => {
    if (!invoice) return;
    Alert.alert(
      'Annuler cette facture ?',
      invoice.outstandingXof > 0
        ? `${formatCurrency(invoice.outstandingXof)} seront retirés du compte de ${clientName}. La facture reste au dossier, marquée annulée.`
        : 'La facture reste au dossier, marquée annulée.',
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: 'Annuler la facture',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelInvoice({ farmId: selectedFarmId, id: invoiceId }).unwrap();
            } catch {
              Alert.alert('Facture', "La facture n’a pas pu être annulée. Réessayez.");
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={8} style={styles.backBtn}>
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{invoice?.invoiceNumber ?? 'Facture'}</Text>
          {invoice && (
            <Text style={[styles.statusText, { color: invoiceStatusColor(invoice.status) }]}>
              {INVOICE_STATUS_LABELS[invoice.status]}
            </Text>
          )}
        </View>
        {/* Sortir la facture : n'importe quel membre qui peut la lire peut l'imprimer ou
            l'envoyer — c'est une lecture, pas une écriture. */}
        {invoice && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Imprimer ou partager la facture"
            onPress={sharePdf}
            disabled={sharing}
            hitSlop={8}
            style={[styles.headerAction, sharing && styles.headerActionBusy]}
          >
            <Share2 size={20} color={tokens.colors.primary[700]} />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading || !invoice ? (
          <Text style={styles.muted}>Chargement…</Text>
        ) : (
          <>
            <Text style={styles.client}>{clientName}</Text>

            <View style={styles.amountCard}>
              <Amount label="Total" value={invoice.totalXof} />
              <Amount label="Encaissé" value={invoice.amountPaidXof} />
              <Amount
                label="Reste"
                value={invoice.outstandingXof}
                color={invoice.outstandingXof > 0 ? tokens.colors.error : tokens.colors.success}
              />
            </View>
            {invoice.dueDate && <Text style={styles.due}>Échéance : {invoice.dueDate}</Text>}

            <Text style={styles.sectionTitle}>Lignes</Text>
            <View style={styles.items}>
              {(invoice.items ?? []).map((it) => (
                <View key={it.id} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemLabel}>{it.articleLabelSnapshot ?? it.articleKey}</Text>
                    <Text style={styles.itemMeta}>
                      {formatNumber(it.quantity)} {it.unit} × {formatCurrency(it.unitPriceXof)}
                    </Text>
                  </View>
                  <Text style={styles.itemTotal}>{formatCurrency(it.lineTotalXof)}</Text>
                </View>
              ))}
              {(invoice.items ?? []).length === 0 && <Text style={styles.muted}>—</Text>}
            </View>

            {canCancel && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Annuler la facture"
                onPress={doCancel}
                disabled={cancelling}
                style={styles.cancelInvoice}
              >
                <Text style={styles.cancelInvoiceLabel}>Annuler la facture</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>

      {canPay && (
        <View style={styles.footer}>
          <Pressable accessibilityRole="button" accessibilityLabel="Encaisser" onPress={() => setSheetOpen(true)} style={styles.commit}>
            <Text style={styles.commitLabel}>Encaisser {formatCurrency(invoice.outstandingXof)}</Text>
          </Pressable>
        </View>
      )}

      {sheetOpen && invoice && (
        <PaymentSheet
          farmId={selectedFarmId}
          invoices={[invoice]}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onDone={() => setSheetOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}

function Amount({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.amountBox}>
      <Text style={styles.amountCaption}>{label}</Text>
      <Text style={[styles.amountVal, color ? { color } : null]}>{formatCurrency(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: tokens.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary[50],
    borderWidth: 1,
    borderColor: tokens.colors.primary[100],
  },
  headerActionBusy: { opacity: 0.5 },
  cancelInvoice: { minHeight: tokens.touch.button, alignItems: 'center', justifyContent: 'center', marginTop: tokens.spacing[6] },
  cancelInvoiceLabel: { ...tokens.typography.button, color: tokens.colors.errorDark },
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
  statusText: { ...tokens.typography.bodySm, fontWeight: '700', marginTop: 2 },

  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[8] },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[6] },
  client: { ...tokens.typography.headingMd, color: tokens.colors.field.text, marginBottom: tokens.spacing[3] },
  amountCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: tokens.spacing[4],
    borderRadius: tokens.radii.xl,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[0],
  },
  amountBox: { gap: 2 },
  amountCaption: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  amountVal: { ...tokens.typography.bodyMd, fontWeight: '700', color: tokens.colors.field.text, fontVariant: ['tabular-nums'] },
  due: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[2] },

  sectionTitle: { ...tokens.typography.headingMd, color: tokens.colors.field.text, marginTop: tokens.spacing[5], marginBottom: tokens.spacing[2] },
  items: { gap: tokens.spacing[2] },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing[3],
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[0],
  },
  itemLabel: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  itemMeta: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  itemTotal: { ...tokens.typography.bodyMd, fontWeight: '700', color: tokens.colors.field.text, fontVariant: ['tabular-nums'] },

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
});
