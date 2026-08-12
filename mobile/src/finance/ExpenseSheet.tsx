/**
 * Nouvelle dépense — mobile port of the web `ExpenseDialog` (create path only;
 * edit/delete of manual expenses stay on the web). Pick a catalog category, a
 * libellé, a montant and a date → `createExpense`. Same backend, same
 * `expense_categories` catalog; UX adapted to a bottom sheet. OWNER/MANAGER only
 * (the caller gates the entry point).
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
import { useCreateExpenseMutation } from '@/store/api/financeApi';
import { tokens } from '@/theme';

/** ISO yyyy-mm-dd today helper for the expense-date default. */
const today = () => new Date().toISOString().slice(0, 10);

export function ExpenseSheet({
  farmId,
  open,
  onClose,
  onDone,
}: {
  farmId: number;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { data: categories = [] } = useGetCatalogQuery({ farmId, category: 'expense_categories' });
  const [createExpense, { isLoading }] = useCreateExpenseMutation();

  const [categoryKey, setCategoryKey] = useState('');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [pickerOpen, setPickerOpen] = useState(false);

  // Reset the form each time the sheet is (re)opened.
  useEffect(() => {
    if (open) {
      setCategoryKey('');
      setLabel('');
      setAmount('');
      setDate(today());
      setPickerOpen(false);
    }
  }, [open]);

  const amountNum = /^\d+$/.test(amount.trim()) ? Number(amount.trim()) : NaN;
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
    try {
      await createExpense({
        farmId,
        body: {
          categoryKey,
          label: label.trim(),
          amountXof: amountNum,
          expenseDate: date.trim(),
        },
      }).unwrap();
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
        <Text style={styles.title}>Nouvelle dépense</Text>
        <Text style={styles.subtitle}>Enregistrez une charge d&apos;exploitation.</Text>

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
          disabled={!canSubmit || isLoading}
          style={[styles.commit, (!canSubmit || isLoading) && styles.commitDisabled]}
        >
          <Text style={styles.commitLabel}>Enregistrer</Text>
        </Pressable>
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
});
