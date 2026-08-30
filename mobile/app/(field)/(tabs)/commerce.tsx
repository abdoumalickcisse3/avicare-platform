/**
 * Commerce tab — the farm's client directory, ported from the web
 * `/commercial/clients` page (same data via `clientsApi`) and reshaped for the
 * field: KPI cards (clients / débiteurs / encours), a Tous/Débiteurs filter, a
 * search box and client cards showing the running balance against the credit
 * limit. Read-only for now — client CRUD, sales and invoices stay on the web.
 * Shown only to roles with `commercial:read`.
 */
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { Phone, Search, ShoppingCart, UserPlus, Users } from 'lucide-react-native';
import { tokens } from '@/theme';
import { AppHeader } from '@/components/AppHeader';
import { useFarmAccess } from '@/auth/useSession';
import { useCreateClientMutation, useGetClientsQuery } from '@/store/api/clientsApi';
import { ClientSheet } from '@/commerce/ClientSheet';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { formatCurrency, formatNumber } from '@/lib/format';
import { CLIENT_TYPE_LABELS, creditColor, creditRatio, initials } from '@/lib/commercial';
import type { Client } from '@/types';

type Tab = 'all' | 'debtors';

export default function CommerceScreen() {
  const router = useRouter();
  const { farmRole } = useFarmAccess();
  const canSell = farmRole === 'OWNER' || farmRole === 'MANAGER';
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [clientSheet, setClientSheet] = useState(false);
  const [createClient, { isLoading: creatingClient }] = useCreateClientMutation();

  const { data: clients, isLoading } = useGetClientsQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId },
  );

  const debtors = useMemo(() => (clients ?? []).filter((c) => c.currentBalanceXof > 0), [clients]);
  const totalEncours = useMemo(
    () => debtors.reduce((sum, c) => sum + c.currentBalanceXof, 0),
    [debtors],
  );

  const filtered = useMemo(() => {
    const rows =
      tab === 'debtors'
        ? [...debtors].sort((a, b) => b.currentBalanceXof - a.currentBalanceXof)
        : (clients ?? []);
    const needle = q.trim().toLowerCase();
    return needle
      ? rows.filter(
          (c) => c.displayName.toLowerCase().includes(needle) || (c.phone ?? '').toLowerCase().includes(needle),
        )
      : rows;
  }, [clients, debtors, tab, q]);

  if (selectedFarmId === null) return <Redirect href="/(field)" />;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Clients</Text>
        <Text style={styles.subtitle}>Votre carnet clients et leurs encours.</Text>

        {/* KPI row */}
        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Users size={18} color={tokens.colors.primary[600]} />
            <Text style={styles.kpiVal}>{formatNumber(clients?.length ?? 0)}</Text>
            <Text style={styles.kpiLabel}>Clients</Text>
          </View>
          <View style={[styles.kpi, debtors.length > 0 && styles.kpiAlert]}>
            <Text style={[styles.kpiVal, debtors.length > 0 && { color: tokens.colors.warning }]}>{formatNumber(debtors.length)}</Text>
            <Text style={styles.kpiLabel}>Débiteurs</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{formatCurrency(totalEncours)}</Text>
            <Text style={styles.kpiLabel}>Encours</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['all', 'debtors'] as const).map((t) => {
            const on = tab === t;
            const label = t === 'all' ? `Tous${clients?.length ? ` (${clients.length})` : ''}` : `Débiteurs${debtors.length ? ` (${debtors.length})` : ''}`;
            return (
              <Pressable key={t} style={[styles.tab, on && styles.tabOn]} onPress={() => setTab(t)} accessibilityRole="button">
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Search size={18} color={tokens.colors.field.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un client…"
            placeholderTextColor={tokens.colors.field.disabled}
            value={q}
            onChangeText={setQ}
          />
        </View>

        {isLoading ? (
          <Text style={styles.muted}>Chargement…</Text>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyDisc}><Users size={28} color={tokens.colors.primary[600]} /></View>
            <Text style={styles.emptyText}>{tab === 'debtors' ? 'Aucun débiteur' : 'Aucun client'}</Text>
            <Text style={styles.emptySub}>
              {tab === 'debtors' ? 'Tous vos clients sont à jour.' : "Ajoutez vos clients depuis l'application web pour suivre leurs encours."}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((c: Client) => {
              const color = creditColor(c);
              const ratio = creditRatio(c);
              return (
                <Pressable
                  key={c.id}
                  style={styles.card}
                  accessibilityRole="button"
                  accessibilityLabel={`Voir ${c.displayName}`}
                  onPress={() => router.push(`/(field)/commerce/client/${c.id}`)}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials(c.displayName) || '?'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name} numberOfLines={1}>{c.displayName}</Text>
                      <View style={styles.metaRow}>
                        <View style={styles.typeChip}><Text style={styles.typeText}>{CLIENT_TYPE_LABELS[c.clientType]}</Text></View>
                        {c.phone ? (
                          <View style={styles.phoneRow}>
                            <Phone size={12} color={tokens.colors.field.textMuted} />
                            <Text style={styles.phone}>{c.phone}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  <View style={styles.balanceRow}>
                    <Text style={styles.balanceLabel}>Encours</Text>
                    <Text style={[styles.balanceVal, { color }]}>{formatCurrency(c.currentBalanceXof)}</Text>
                  </View>
                  {ratio != null ? (
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${Math.min(Math.round(ratio * 100), 100)}%`, backgroundColor: color }]} />
                    </View>
                  ) : (
                    <Text style={styles.noLimit}>Pas de limite de crédit</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {canSell && (
        <View style={styles.fabStack}>
          {/* Adding a client used to be possible only during onboarding — a directory you
              cannot add to stops being a directory the first time a new buyer turns up. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Nouveau client"
            onPress={() => setClientSheet(true)}
            style={styles.fabSecondary}
          >
            <UserPlus size={20} color={tokens.colors.field.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Nouvelle vente"
            onPress={() => router.push('/(field)/commerce/vente')}
            style={styles.fab}
          >
            <ShoppingCart size={24} color={tokens.colors.primary[900]} />
          </Pressable>
        </View>
      )}

      <ClientSheet
        open={clientSheet}
        client={null}
        saving={creatingClient}
        onClose={() => setClientSheet(false)}
        onSubmit={async (body) => {
          if (selectedFarmId === null) return;
          try {
            await createClient({ farmId: selectedFarmId, body }).unwrap();
            setClientSheet(false);
          } catch {
            Alert.alert('Client non créé', "Vérifiez le nom et réessayez.");
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[16] },
  fabStack: {
    position: 'absolute',
    right: tokens.layout.screenPadding,
    bottom: tokens.spacing[6],
    alignItems: 'center',
    gap: tokens.spacing[3],
  },
  fabSecondary: {
    width: 52,
    height: 52,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.neutral[0],
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
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
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[1], marginBottom: tokens.spacing[4] },

  kpiRow: { flexDirection: 'row', gap: tokens.spacing[2], marginBottom: tokens.spacing[4] },
  kpi: { flex: 1, backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200], borderRadius: tokens.radii.lg, padding: tokens.spacing[3], gap: tokens.spacing[1] },
  kpiAlert: { borderColor: tokens.colors.warning },
  kpiVal: { ...tokens.typography.numericSm, fontSize: 15, color: tokens.colors.field.text },
  kpiLabel: { ...tokens.typography.bodySm, fontSize: 11, color: tokens.colors.field.textMuted },

  tabs: { flexDirection: 'row', gap: tokens.spacing[2], marginBottom: tokens.spacing[3] },
  tab: { paddingHorizontal: tokens.spacing[4], paddingVertical: tokens.spacing[2], borderRadius: tokens.radii.full, backgroundColor: tokens.colors.neutral[100] },
  tabOn: { backgroundColor: tokens.colors.primary[600] },
  tabText: { ...tokens.typography.bodySm, fontWeight: '600', color: tokens.colors.field.textMuted },
  tabTextOn: { color: tokens.colors.neutral[0] },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200], borderRadius: tokens.radii.lg, paddingHorizontal: tokens.spacing[3], minHeight: 46, marginBottom: tokens.spacing[3] },
  searchInput: { flex: 1, ...tokens.typography.bodyMd, color: tokens.colors.field.text },

  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[8] },
  emptyBox: { alignItems: 'center', gap: tokens.spacing[2], paddingVertical: tokens.spacing[10] },
  emptyDisc: { width: 60, height: 60, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.primary[50], alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  emptySub: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, textAlign: 'center', paddingHorizontal: tokens.spacing[6] },

  list: { gap: tokens.spacing[3] },
  card: { backgroundColor: tokens.colors.neutral[0], borderRadius: tokens.radii.xl, borderWidth: 1, borderColor: tokens.colors.neutral[200], padding: tokens.spacing[4], gap: tokens.spacing[3] },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3] },
  avatar: { width: 40, height: 40, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.primary[100], alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...tokens.typography.bodySm, fontWeight: '700', color: tokens.colors.primary[700] },
  name: { ...tokens.typography.headingMd, fontSize: 16, color: tokens.colors.field.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], marginTop: 3 },
  typeChip: { borderRadius: tokens.radii.full, borderWidth: 1, borderColor: tokens.colors.neutral[300], paddingHorizontal: tokens.spacing[2], paddingVertical: 1 },
  typeText: { ...tokens.typography.bodySm, fontSize: 10, fontWeight: '600', color: tokens.colors.field.textMuted },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  phone: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },

  balanceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  balanceLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  balanceVal: { ...tokens.typography.numericSm, fontSize: 15 },
  track: { height: 6, borderRadius: 3, backgroundColor: tokens.colors.neutral[200], overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  noLimit: { ...tokens.typography.bodySm, fontSize: 11, color: tokens.colors.field.textMuted },
});
