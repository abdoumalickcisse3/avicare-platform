/**
 * Client detail — the running account (compte courant) for one commercial
 * client: encours hero, open invoices, and an "Encaisser" action (OWNER/MANAGER
 * only, mirroring WRITE_MANAGER) that opens the payment sheet. Read data from
 * the same slices as the web. Bold polish lands in a later task.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useGetClientsQuery } from '@/store/api/clientsApi';
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

  const { data: clients } = useGetClientsQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId },
  );
  const { data: invoices, isLoading } = useGetInvoicesQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId, clientId },
  );

  const [sheetOpen, setSheetOpen] = useState(false);

  const client = clients?.find((c) => c.id === clientId);
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
});
