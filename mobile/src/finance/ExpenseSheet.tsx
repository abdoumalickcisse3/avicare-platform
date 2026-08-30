/**
 * Record or correct an expense — mobile port of the web `ExpenseDialog`.
 *
 * Editing is offered only on MANUAL expenses, because the backend refuses the rest: an expense
 * derived from a purchase order, a vet visit or a salary answers 422 EXPENSE_NOT_EDITABLE. Those
 * are a consequence of something else, and the way to change them is to change that something —
 * the caller therefore never opens this sheet on one.
 *
 * OWNER/MANAGER only (the caller gates the entry point).
 */
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, ChevronDown } from 'lucide-react-native';
import { useGetCatalogQuery } from '@/store/api/catalogApi';
import {
  useCreateExpenseMutation,
  useDeleteExpenseMutation,
  useUpdateExpenseMutation,
} from '@/store/api/financeApi';
import { tokens } from '@/theme';
import { formatCurrency } from '@/lib/format';
import type { Expense } from '@/types';

/** ISO yyyy-mm-dd today helper for the expense-date default. */
const today = () => new Date().toISOString().slice(0, 10);

export function ExpenseSheet({
  farmId,
  open,
  expense = null,
  onClose,
  onDone,
}: {
  farmId: number;
  open: boolean;
  /** A MANUAL expense to correct, or null to record a new one. */
  expense?: Expense | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { data: categories = [] } = useGetCatalogQuery({ farmId, category: 'expense_categories' });
  const [createExpense, { isLoading }] = useCreateExpenseMutation();
  const [updateExpense, { isLoading: updating }] = useUpdateExpenseMutation();
  const [deleteExpense] = useDeleteExpenseMutation();

  const [categoryKey, setCategoryKey] = useState('');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [pickerOpen, setPickerOpen] = useState(false);

  // Reset the form each time the sheet is (re)opened.
  useEffect(() => {
    if (open) {
      setCategoryKey(expense?.categoryKey ?? '');
      setLabel(expense?.label ?? '');
      setAmount(expense != null ? String(expense.amountXof) : '');
      setDate(expense?.expenseDate ?? today());
      setPickerOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense?.id]);

  const amountNum = /^\d+$/.test(amount.trim()) ? Number(amount.trim()) : NaN;
  const busy = isLoading || updating;
  const canSubmit =
    categoryKey !== '' &&
    label.trim() !== '' &&
    Number.isInteger(amountNum) &&
    amountNum > 0 &&
    date.trim() !== '';

  const categoryLabel = (key: string) =>
    String(categories.find((c) => c.key === key)?.value.label ?? key);

  const submit = async () => {
    if (!canSubmit) return;
    const body = {
      categoryKey,
      label: label.trim(),
      amountXof: amountNum,
      expenseDate: date.trim(),
    };
    try {
      if (expense) await updateExpense({ farmId, id: expense.id, body }).unwrap();
      else await createExpense({ farmId, body }).unwrap();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone();
    } catch {
      Alert.alert('Dépense', "La dépense n'a pas pu être enregistrée. Réessayez.");
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Fermer" onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>{expense ? 'Corriger la dépense' : 'Nouvelle dépense'}</Text>
        <Text style={styles.subtitle}>
          {expense
            ? 'La correction remplace la ligne dans votre comptabilité.'
            : "Enregistrez une charge d'exploitation."}
        </Text>

        <Text style={styles.fieldLabel}>Catégorie</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choisir une catégorie"
          onPress={() => setPickerOpen((v) => !v)}
          style={styles.select}
        >
          <Text style={[styles.selectText, categoryKey === '' && styles.selectPlaceholder]}>
            {categoryKey === '' ? 'Choisir…' : categoryLabel(categoryKey)}
          </Text>
          <ChevronDown size={18} color={tokens.colors.field.textMuted} />
        </Pressable>
        {pickerOpen && (
          <View style={styles.picker}>
            <ScrollView style={styles.pickerScroll} keyboardShouldPersistTaps="handled">
              {categories.length === 0 ? (
                <Text style={styles.pickerEmpty}>Aucune catégorie configurée.</Text>
              ) : (
                categories.map((c) => {
                  const on = c.key === categoryKey;
                  return (
                    <Pressable
                      key={c.key}
                      accessibilityRole="button"
                      accessibilityLabel={String(c.value.label ?? c.key)}
                      onPress={() => {
                        setCategoryKey(c.key);
                        setPickerOpen(false);
                      }}
                      style={styles.pickerRow}
                    >
                      <Text style={[styles.pickerRowText, on && styles.pickerRowTextOn]}>
                        {String(c.value.label ?? c.key)}
                      </Text>
                      {on && <Check size={16} color={tokens.colors.primary[600]} />}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        )}

        <Text style={styles.fieldLabel}>Libellé</Text>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="Ex. Sac aliment démarrage"
          placeholderTextColor={tokens.colors.field.disabled}
          accessibilityLabel="Libellé"
          style={styles.input}
          maxLength={120}
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Montant (XOF)</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              inputMode="numeric"
              placeholder="0"
              placeholderTextColor={tokens.colors.field.disabled}
              accessibilityLabel="Montant"
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Date</Text>
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="AAAA-MM-JJ"
              placeholderTextColor={tokens.colors.field.disabled}
              accessibilityLabel="Date"
              autoCapitalize="none"
              style={styles.input}
            />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enregistrer la dépense"
          onPress={submit}
          disabled={!canSubmit || busy}
          style={[styles.commit, (!canSubmit || busy) && styles.commitDisabled]}
        >
          <Text style={styles.commitLabel}>Enregistrer</Text>
        </Pressable>

        {expense ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Supprimer la dépense"
            onPress={() =>
              Alert.alert(
                'Supprimer cette dépense ?',
                `${formatCurrency(expense.amountXof)} sortiront de votre comptabilité. La marge de la ferme sera recalculée sans cette ligne.`,
                [
                  { text: 'Annuler', style: 'cancel' },
                  {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                      await deleteExpense({ farmId, id: expense.id });
                      onDone();
                    },
                  },
                ],
              )
            }
            style={styles.deleteBtn}
          >
            <Text style={styles.deleteText}>Supprimer la dépense</Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(18,43,18,0.35)' },
  sheet: {
    backgroundColor: tokens.colors.neutral[0],
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    padding: tokens.layout.screenPadding,
    paddingBottom: tokens.spacing[8],
    gap: tokens.spacing[1],
  },
  title: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginBottom: tokens.spacing[1] },
  fieldLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[2] },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[300],
    paddingHorizontal: tokens.spacing[3],
  },
  selectText: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  selectPlaceholder: { color: tokens.colors.field.disabled },
  picker: {
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[0],
    marginTop: tokens.spacing[1],
    overflow: 'hidden',
  },
  pickerScroll: { maxHeight: 180 },
  pickerEmpty: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, padding: tokens.spacing[3] },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.neutral[100],
  },
  pickerRowText: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  pickerRowTextOn: { color: tokens.colors.primary[600], fontWeight: '700' },
  input: {
    minHeight: 46,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[300],
    paddingHorizontal: tokens.spacing[3],
    color: tokens.colors.field.text,
    ...tokens.typography.bodyMd,
  },
  row: { flexDirection: 'row', gap: tokens.spacing[3] },
  commit: {
    minHeight: tokens.touch.primaryButton,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.accent[400],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing[4],
  },
  commitDisabled: { opacity: 0.4 },
  commitLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.primary[900] },
  deleteBtn: {
    minHeight: tokens.touch.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing[2],
  },
  deleteText: { ...tokens.typography.button, color: tokens.colors.errorDark },
});
