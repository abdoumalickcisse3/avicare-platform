/**
 * A small titled list with an inline add form. Used for the optional supplier
 * and client sections during onboarding: shows what exists, plus a compact row
 * of inputs (text + chip-selects) and an "Ajouter" button. The parent owns the
 * mutation; this component owns the transient form state.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { tokens } from '@/theme';
import { FormField } from '@/components/field/FormField';

export interface QuickField {
  name: string;
  placeholder: string;
  kind: 'text' | 'select';
  required?: boolean;
  options?: { value: string; label: string }[];
}

export interface QuickItem {
  id: number | string;
  primary: string;
  secondary?: string;
}

export function QuickAddList({
  title,
  hint,
  items,
  fields,
  onAdd,
  adding,
}: {
  title: string;
  hint: string;
  items: QuickItem[];
  fields: QuickField[];
  onAdd: (values: Record<string, string>) => Promise<void>;
  adding: boolean;
}) {
  const initial = () =>
    Object.fromEntries(fields.map((f) => [f.name, f.kind === 'select' ? (f.options?.[0]?.value ?? '') : ''])) as Record<
      string,
      string
    >;
  const [values, setValues] = useState<Record<string, string>>(initial);

  const requiredNames = fields.filter((f) => f.required).map((f) => f.name);
  const canAdd = requiredNames.every((n) => (values[n] ?? '').trim().length > 0);

  const set = (name: string, v: string) => setValues((prev) => ({ ...prev, [name]: v }));

  async function submit() {
    if (!canAdd) return;
    try {
      await onAdd(values);
      setValues(initial());
    } catch {
      // keep values so the user can retry
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>{hint}</Text>

      {items.length > 0 ? (
        <View style={styles.rows}>
          {items.map((it) => (
            <View key={it.id} style={styles.row}>
              <Text style={styles.rowPrimary}>{it.primary}</Text>
              {it.secondary ? <Text style={styles.rowSecondary}>{it.secondary}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.form}>
        {fields.map((f) =>
          f.kind === 'select' ? (
            <View key={f.name}>
              <View style={styles.chips}>
                {(f.options ?? []).map((o) => {
                  const on = values[f.name] === o.value;
                  return (
                    <Pressable
                      key={o.value}
                      onPress={() => set(f.name, o.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            <FormField
              key={f.name}
              label={f.placeholder}
              value={values[f.name] ?? ''}
              onChangeText={(t) => set(f.name, t)}
              placeholder={f.placeholder}
            />
          ),
        )}
        <Pressable
          onPress={submit}
          disabled={!canAdd || adding}
          accessibilityRole="button"
          accessibilityLabel={`Ajouter — ${title}`}
          style={[styles.addBtn, (!canAdd || adding) && styles.addDisabled]}
        >
          <Plus size={16} color={tokens.colors.neutral[0]} />
          <Text style={styles.addText}>Ajouter</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: tokens.spacing[4],
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[0],
    gap: tokens.spacing[2],
  },
  title: { ...tokens.typography.headingMd, color: tokens.colors.neutral[900] },
  hint: { ...tokens.typography.bodySm, color: tokens.colors.neutral[600] },
  rows: { gap: tokens.spacing[2], marginTop: tokens.spacing[1] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.neutral[50],
  },
  rowPrimary: { ...tokens.typography.bodyMd, color: tokens.colors.neutral[900] },
  rowSecondary: { ...tokens.typography.bodySm, color: tokens.colors.neutral[500] },
  form: { gap: tokens.spacing[3], marginTop: tokens.spacing[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  chip: {
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[1],
    borderRadius: tokens.radii.full,
    borderWidth: 1.5,
    borderColor: tokens.colors.neutral[200],
  },
  chipOn: { borderColor: tokens.colors.primary[500], backgroundColor: tokens.colors.primary[50] },
  chipText: { ...tokens.typography.bodySm, color: tokens.colors.neutral[700] },
  chipTextOn: { color: tokens.colors.primary[700] },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[1],
    minHeight: tokens.touch.button,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.primary[600],
  },
  addDisabled: { backgroundColor: tokens.colors.neutral[300] },
  addText: { ...tokens.typography.button, color: tokens.colors.neutral[0] },
});
