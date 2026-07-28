/**
 * Labeled form field — the mobile equivalent of the web dialogs' MUI
 * `TextField` (label above, outlined input, optional helper/error line).
 * Used by the four entry screens (journalier, pesée, œufs, mortalité) so they
 * read as faithful replicas of `DailyRecordDialog` / `WeighingDialog` /
 * `EggCollectionDialog` rather than the field-first counters.
 */
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { CalendarDays } from 'lucide-react-native';
import { tokens } from '@/theme';

/** Human date `DD/MM/YYYY` for the read-only date field. */
function todayHuman(): string {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

/**
 * Read-only "today" date field — the web dialogs open with the date defaulting
 * to today (a field entry is captured the day it happens). Rendered as a
 * disabled field to keep the form shape identical without pulling in a native
 * date-picker dependency.
 */
export function TodayDateField({ label = 'Date' }: { label?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.input, styles.dateInput]}>
        <CalendarDays size={18} color={tokens.colors.field.textMuted} />
        <Text style={styles.dateText}>{todayHuman()}</Text>
        <Text style={styles.dateTag}>Aujourd&apos;hui</Text>
      </View>
    </View>
  );
}

export function FormField({
  label,
  required,
  helperText,
  error,
  style,
  multiline,
  ...inputProps
}: {
  label: string;
  required?: boolean;
  helperText?: string;
  error?: string;
} & TextInputProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline, !!error && styles.inputError, style]}
        placeholderTextColor={tokens.colors.field.disabled}
        multiline={multiline}
        accessibilityLabel={label}
        {...inputProps}
      />
      {(error || helperText) && (
        <Text style={[styles.helper, !!error && styles.helperError]}>{error ?? helperText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.spacing[1] },
  label: { ...tokens.typography.bodySm, fontWeight: '600', color: tokens.colors.field.text },
  required: { color: tokens.colors.error },
  input: {
    ...tokens.typography.bodyLg,
    color: tokens.colors.field.text,
    minHeight: tokens.touch.field,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.neutral[300],
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing[3],
    backgroundColor: tokens.colors.neutral[0],
  },
  inputMultiline: { minHeight: 76, paddingTop: tokens.spacing[3], textAlignVertical: 'top' },
  inputError: { borderColor: tokens.colors.error },
  helper: { ...tokens.typography.bodySm, fontSize: 11, color: tokens.colors.field.textMuted },
  helperError: { color: tokens.colors.error },
  dateInput: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], backgroundColor: tokens.colors.neutral[50] },
  dateText: { ...tokens.typography.numericSm, fontSize: 15, color: tokens.colors.field.text, flex: 1 },
  dateTag: { ...tokens.typography.bodySm, fontSize: 11, color: tokens.colors.field.textMuted },
});
