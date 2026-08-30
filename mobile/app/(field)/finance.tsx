/**
 * Finance — mobile port of the web finance module (`/finance/depenses` +
 * `/finance/salaires`), reshaped into a single field screen with a Dépenses /
 * Salaires segmented control. Same backend (`financeApi`), same
 * `expense_categories` catalog. Four segments: Dépenses (record, correct, delete
 * — only MANUAL ones, the rest are refused by the backend), Salaires (generate a
 * month, pay a line), Avances (grant or refuse), Analyse.
 *
 * Reachable by OWNER / MANAGER (finance tab); writes are OWNER / MANAGER.
 */
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { Plus, Receipt, Wallet } from 'lucide-react-native';
import { tokens } from '@/theme';
import { AppHeader } from '@/components/AppHeader';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useGetCatalogQuery } from '@/store/api/catalogApi';
import {
  useApproveAdvanceMutation,
  useGenerateSalariesMutation,
  useGetAdvancesQuery,
  useGetExpensesQuery,
  useGetSalariesQuery,
  useGetSalarySettingsQuery,
  usePaySalaryMutation,
  useRejectAdvanceMutation,
} from '@/store/api/financeApi';
import { useGetMembersQuery } from '@/store/api/membersApi';
import { AdvancesPanel } from '@/finance/AdvancesPanel';
import { SalaryGenerateSheet } from '@/finance/SalaryGenerateSheet';
import { formatCurrency } from '@/lib/format';
import { ExpenseSheet } from '@/finance/ExpenseSheet';
import { FinanceAnalytics } from '@/finance/FinanceAnalytics';
import type { Expense, ExpenseSource, Salary, SalaryStatus } from '@/types';

type Tab = 'expenses' | 'salaries' | 'advances' | 'analytics';

const SOURCE_LABELS: Record<ExpenseSource, string> = {
  MANUAL: 'Manuelle',
  PURCHASE: 'Achat',
  STOCK_ENTRY: 'Entrée stock',
  SALARY: 'Salaire',
};

const STATUS_META: Record<SalaryStatus, { label: string; color: string }> = {
  DUE: { label: 'Dû', color: tokens.colors.warning },
  PAID: { label: 'Payé', color: tokens.colors.success },
};

/** Current month as YYYY-MM — the salaries default period, like the web. */
function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function FinanceScreen() {
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { farmRole, isAdmin } = useFarmAccess();
  const canManage = isAdmin || farmRole === 'OWNER' || farmRole === 'MANAGER';

  const [tab, setTab] = useState<Tab>('expenses');
  const [editing, setEditing] = useState<Expense | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const period = useMemo(currentPeriod, []);

  const arg = selectedFarmId === null ? skipToken : { farmId: selectedFarmId };
  const { data: expenses, isLoading: expensesLoading } = useGetExpensesQuery(arg);
  const { data: salaries, isLoading: salariesLoading } = useGetSalariesQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId, period },
  );
  const { data: categories = [] } = useGetCatalogQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId, category: 'expense_categories' },
  );
  const [paySalary, { isLoading: paying }] = usePaySalaryMutation();
  const { data: advances = [] } = useGetAdvancesQuery(tab === 'advances' ? arg : skipToken);
  const { data: salarySettings = [] } = useGetSalarySettingsQuery(
    tab === 'salaries' ? arg : skipToken,
  );
  const { data: members = [] } = useGetMembersQuery(
    selectedFarmId === null || (tab !== 'advances' && tab !== 'salaries')
      ? skipToken
      : selectedFarmId,
  );
  const [approveAdvance] = useApproveAdvanceMutation();
  const [rejectAdvance] = useRejectAdvanceMutation();
  const [generateSalaries, { isLoading: generating }] = useGenerateSalariesMutation();

  // The finance payloads carry a userId and nothing else; the roster is what turns it into a
  // person. Falling back to the id keeps the row readable while the roster loads.
  const memberName = (userId: number) =>
    members.find((m) => m.userId === userId)?.fullName ?? `Salarié #${userId}`;

  const totalExpenses = useMemo(
    () => (expenses ?? []).reduce((sum, e) => sum + e.amountXof, 0),
    [expenses],
  );
  const totalSalariesDue = useMemo(
    () => (salaries ?? []).filter((s) => s.status === 'DUE').reduce((sum, s) => sum + s.netXof, 0),
    [salaries],
  );

  if (selectedFarmId === null) return <Redirect href="/(field)" />;

  const categoryLabel = (key: string) =>
    String(categories.find((c) => c.key === key)?.value.label ?? key);

  const confirmPay = (salary: Salary) => {
    Alert.alert(
      'Marquer payé',
      `Confirmer le paiement du salaire (${formatCurrency(salary.netXof)}) ? Une dépense sera enregistrée.`,
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: 'Payer',
          onPress: async () => {
            try {
              await paySalary({ farmId: selectedFarmId, id: salary.id }).unwrap();
            } catch {
              Alert.alert('Salaire', "Le paiement a échoué. Réessayez.");
            }
          },
        },
      ],
    );
  };

  const heroValue = tab === 'expenses' ? totalExpenses : totalSalariesDue;
  const heroLabel = tab === 'expenses' ? 'Total des dépenses' : 'Salaires dus (ce mois)';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Finance</Text>
        <Text style={styles.subtitle}>Dépenses, salaires et rentabilité de la ferme.</Text>

        {/* Hero KPI (hidden on Analytique — that view has its own margin hero) */}
        {tab !== 'analytics' && (
          <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.hero}>
            <LinearGradient
              colors={[tokens.colors.primary[600], tokens.colors.primary[900]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroIcon}>
              {tab === 'expenses' ? (
                <Receipt size={20} color={tokens.colors.neutral[0]} />
              ) : (
                <Wallet size={20} color={tokens.colors.neutral[0]} />
              )}
            </View>
            <Text style={styles.heroLabel}>{heroLabel}</Text>
            <Text style={styles.heroValue}>{formatCurrency(heroValue)}</Text>
          </Animated.View>
        )}

        {/* Segmented control */}
        <View style={styles.segment}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Onglet Dépenses"
            onPress={() => setTab('expenses')}
            style={[styles.segmentBtn, tab === 'expenses' && styles.segmentBtnOn]}
          >
            <Text style={[styles.segmentText, tab === 'expenses' && styles.segmentTextOn]}>Dépenses</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Onglet Salaires"
            onPress={() => setTab('salaries')}
            style={[styles.segmentBtn, tab === 'salaries' && styles.segmentBtnOn]}
          >
            <Text style={[styles.segmentText, tab === 'salaries' && styles.segmentTextOn]}>Salaires</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Onglet Avances"
            onPress={() => setTab('advances')}
            style={[styles.segmentBtn, tab === 'advances' && styles.segmentBtnOn]}
          >
            <Text style={[styles.segmentText, tab === 'advances' && styles.segmentTextOn]}>Avances</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Onglet Analytique"
            onPress={() => setTab('analytics')}
            style={[styles.segmentBtn, tab === 'analytics' && styles.segmentBtnOn]}
          >
            <Text style={[styles.segmentText, tab === 'analytics' && styles.segmentTextOn]}>Analytique</Text>
          </Pressable>
        </View>

        {tab === 'expenses' ? (
          expensesLoading ? (
            <Text style={styles.muted}>Chargement…</Text>
          ) : (expenses ?? []).length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyDisc}>
                <Receipt size={28} color={tokens.colors.primary[600]} />
              </View>
              <Text style={styles.emptyText}>Aucune dépense</Text>
              <Text style={styles.emptySub}>Enregistrez la première charge d&apos;exploitation.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {(expenses ?? []).map((e: Expense, i) => (
                <Animated.View key={e.id} entering={FadeInDown.delay(i * 40).springify().damping(18)}>
                  <Pressable
                    // Only MANUAL expenses are editable: the backend answers 422
                    // EXPENSE_NOT_EDITABLE on one derived from a purchase, a vet visit or a
                    // salary, so those rows open nothing.
                    disabled={!canManage || e.source !== 'MANUAL'}
                    accessibilityRole={canManage && e.source === 'MANUAL' ? 'button' : undefined}
                    accessibilityLabel={
                      canManage && e.source === 'MANUAL' ? `Corriger ${e.label}` : undefined
                    }
                    onPress={() => setEditing(e)}
                    style={styles.card}
                  >
                  <View style={styles.cardTop}>
                    <Text style={styles.cardLabel} numberOfLines={1}>{e.label}</Text>
                    <Text style={styles.cardAmount}>{formatCurrency(e.amountXof)}</Text>
                  </View>
                  <View style={styles.cardBottom}>
                    <Text style={styles.cardMeta}>
                      {categoryLabel(e.categoryKey)} · {e.expenseDate}
                    </Text>
                    <View
                      style={[
                        styles.sourceChip,
                        { backgroundColor: e.source === 'MANUAL' ? tokens.colors.accent[50] : tokens.colors.primary[50] },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sourceText,
                          { color: e.source === 'MANUAL' ? tokens.colors.accent[700] : tokens.colors.primary[700] },
                        ]}
                      >
                        {SOURCE_LABELS[e.source]}
                      </Text>
                    </View>
                  </View>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          )
        ) : tab === 'advances' ? (
          <AdvancesPanel
            advances={advances}
            canDecide={canManage}
            memberName={memberName}
            onApprove={(a) => {
              if (selectedFarmId !== null) approveAdvance({ farmId: selectedFarmId, id: a.id });
            }}
            onReject={(a) => {
              if (selectedFarmId !== null) rejectAdvance({ farmId: selectedFarmId, id: a.id });
            }}
          />
        ) : tab === 'analytics' ? (
          <FinanceAnalytics farmId={selectedFarmId} />
        ) : salariesLoading ? (
          <Text style={styles.muted}>Chargement…</Text>
        ) : (salaries ?? []).length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyDisc}>
              <Wallet size={28} color={tokens.colors.primary[600]} />
            </View>
            <Text style={styles.emptyText}>Aucun salaire pour {period}.</Text>
            {canManage ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Générer les salaires"
                onPress={() => setGenerateOpen(true)}
                style={styles.emptyCta}
              >
                <Text style={styles.emptyCtaText}>Générer les salaires du mois</Text>
              </Pressable>
            ) : (
              <Text style={styles.emptySub}>
                Seuls le propriétaire et le gestionnaire génèrent les salaires.
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.list}>
            {(salaries ?? []).map((s: Salary, i) => {
              const meta = STATUS_META[s.status];
              return (
                <Animated.View key={s.id} entering={FadeInDown.delay(i * 40).springify().damping(18)} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardLabel}>Salarié #{s.userId}</Text>
                    <Text style={styles.cardAmount}>{formatCurrency(s.netXof)}</Text>
                  </View>
                  <View style={styles.cardBottom}>
                    <Text style={styles.cardMeta}>
                      {s.period} · Brut {formatCurrency(s.grossXof)}
                    </Text>
                    <View style={[styles.statusChip, { borderColor: meta.color }]}>
                      <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  </View>
                  {canManage && s.status === 'DUE' && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Payer le salaire #${s.userId}`}
                      onPress={() => confirmPay(s)}
                      disabled={paying}
                      style={styles.payBtn}
                    >
                      <Text style={styles.payLabel}>Marquer payé</Text>
                    </Pressable>
                  )}
                </Animated.View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {canManage && tab === 'expenses' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nouvelle dépense"
          onPress={() => setSheetOpen(true)}
          style={styles.fab}
        >
          <Plus size={24} color={tokens.colors.primary[900]} />
        </Pressable>
      )}

      <ExpenseSheet
        farmId={selectedFarmId}
        open={sheetOpen || editing !== null}
        expense={editing}
        onClose={() => {
          setSheetOpen(false);
          setEditing(null);
        }}
        onDone={() => {
          setSheetOpen(false);
          setEditing(null);
        }}
      />

      <SalaryGenerateSheet
        open={generateOpen}
        settings={salarySettings}
        saving={generating}
        memberName={memberName}
        onClose={() => setGenerateOpen(false)}
        onSubmit={async (p) => {
          if (selectedFarmId === null) return;
          try {
            await generateSalaries({ farmId: selectedFarmId, period: p }).unwrap();
            setGenerateOpen(false);
          } catch {
            Alert.alert(
              'Salaires non générés',
              `Des salaires existent déjà pour ${p}. La génération se fait une seule fois par mois, pour tout le monde.`,
            );
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.layout.fabScrollClearance },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[1], marginBottom: tokens.spacing[4] },

  hero: {
    borderRadius: tokens.radii.xl,
    overflow: 'hidden',
    padding: tokens.spacing[5],
    gap: tokens.spacing[1],
    marginBottom: tokens.spacing[4],
    shadowColor: tokens.colors.primary[900],
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: tokens.radii.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing[1],
  },
  heroLabel: { ...tokens.typography.bodySm, color: 'rgba(255,255,255,0.85)' },
  heroValue: { ...tokens.typography.displayLg, color: tokens.colors.neutral[0], fontVariant: ['tabular-nums'] },

  segment: { flexDirection: 'row', backgroundColor: tokens.colors.neutral[100], borderRadius: tokens.radii.full, padding: 4, marginBottom: tokens.spacing[4] },
  segmentBtn: { flex: 1, paddingVertical: tokens.spacing[2], borderRadius: tokens.radii.full, alignItems: 'center' },
  segmentBtnOn: { backgroundColor: tokens.colors.neutral[0], shadowColor: tokens.colors.primary[900], shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  segmentText: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.textMuted },
  segmentTextOn: { color: tokens.colors.primary[700] },

  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[8] },
  emptyBox: { alignItems: 'center', gap: tokens.spacing[2], paddingVertical: tokens.spacing[10] },
  emptyDisc: { width: 60, height: 60, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.primary[50], alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  emptySub: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, textAlign: 'center', paddingHorizontal: tokens.spacing[6] },

  list: { gap: tokens.spacing[3] },
  card: { backgroundColor: tokens.colors.neutral[0], borderRadius: tokens.radii.xl, borderWidth: 1, borderColor: tokens.colors.neutral[200], padding: tokens.spacing[4], gap: tokens.spacing[2] },
  cardTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: tokens.spacing[2] },
  cardLabel: { ...tokens.typography.bodyMd, fontWeight: '700', color: tokens.colors.field.text, flex: 1 },
  cardAmount: { ...tokens.typography.numericSm, fontSize: 15, color: tokens.colors.primary[600] },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing[2] },
  cardMeta: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, flex: 1 },
  sourceChip: { borderRadius: tokens.radii.full, paddingHorizontal: tokens.spacing[2], paddingVertical: 2 },
  sourceText: { ...tokens.typography.bodySm, fontSize: 10, fontWeight: '700' },
  statusChip: { borderRadius: tokens.radii.full, borderWidth: 1, paddingHorizontal: tokens.spacing[2], paddingVertical: 1 },
  statusText: { ...tokens.typography.bodySm, fontSize: 10, fontWeight: '700' },
  payBtn: { alignSelf: 'flex-start', marginTop: tokens.spacing[1], borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.primary[600], paddingHorizontal: tokens.spacing[4], paddingVertical: tokens.spacing[2] },
  payLabel: { ...tokens.typography.bodySm, fontWeight: '700', color: tokens.colors.primary[600] },

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
  emptyCta: {
    minHeight: tokens.touch.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[5],
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.action.commit.bg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.commit.border,
    marginTop: tokens.spacing[2],
  },
  emptyCtaText: { ...tokens.typography.button, color: tokens.colors.action.commit.fg },
});
