/**
 * A keep/remove/add list over a seeded catalog category (stock articles, sales
 * channels, expense categories). Platform entries can be disabled and custom
 * ones deleted (both via delete); "+ Ajouter" creates a custom override built
 * from the category's fields. Mobile-native (rows + inline sheet, no table).
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { tokens } from '@/theme';
import { FormField } from '@/components/field/FormField';
import type { CategoryConfig } from '@/constants/catalogCategories';
import {
  useDeleteCatalogEntryMutation,
  useGetCatalogQuery,
  useOverrideCatalogEntryMutation,
} from '@/store/api/catalogApi';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function ManagedCatalogList({ farmId, config }: { farmId: number; config: CategoryConfig }) {
  const category = config.backendCategory;
  const { data } = useGetCatalogQuery({ farmId, category });
  const [override, { isLoading: adding }] = useOverrideCatalogEntryMutation();
  const [deleteEntry] = useDeleteCatalogEntryMutation();

  const editable = useMemo(() => config.fields.filter((f) => f.const === undefined), [config.fields]);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const entries = data ?? [];
  const labelOf = (v: Record<string, unknown>, key: string) => String(v?.[config.labelField] ?? key);

  const set = (name: string, v: string) => setValues((prev) => ({ ...prev, [name]: v }));
  const canAdd = (values[config.labelField] ?? '').trim().length > 0;

  async function add() {
    if (!canAdd) return;
    const value: Record<string, unknown> = { ...values };
    for (const f of config.fields) if (f.const !== undefined) value[f.name] = f.const;
    const key = slugify(String(values[config.labelField]));
    try {
      await override({ farmId, category, key, value }).unwrap();
      setValues({});
      setOpen(false);
    } catch {
      // keep the form open; the row simply won't appear
    }
  }

  async function remove(key: string) {
    try {
      await deleteEntry({ farmId, category, key }).unwrap();
    } catch {
      // no-op — the entry stays
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.rows}>
        {entries.map((e) => (
          <View key={e.key} style={styles.row}>
            <Text style={styles.rowLabel}>{labelOf(e.value, e.key)}</Text>
            <View style={styles.rowRight}>
              <View style={[styles.badge, e.custom ? styles.badgeCustom : styles.badgePlatform]}>
                <Text style={[styles.badgeText, e.custom ? styles.badgeTextCustom : styles.badgeTextPlatform]}>
                  {e.custom ? 'Perso' : 'Plateforme'}
                </Text>
              </View>
              <Pressable
                onPress={() => remove(e.key)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Retirer ${labelOf(e.value, e.key)}`}
                style={styles.removeBtn}
              >
                <X size={16} color={tokens.colors.neutral[500]} />
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      {open ? (
        <View style={styles.form}>
          {editable.map((f) =>
            f.kind === 'select' ? (
              <View key={f.name}>
                <Text style={styles.groupLabel}>{f.label}</Text>
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
                label={f.label}
                value={values[f.name] ?? ''}
                onChangeText={(t) => set(f.name, t)}
              />
            ),
          )}
          <View style={styles.formActions}>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Annuler</Text>
            </Pressable>
            <Pressable
              onPress={add}
              disabled={!canAdd || adding}
              accessibilityRole="button"
              accessibilityLabel="Enregistrer"
              style={[styles.saveBtn, (!canAdd || adding) && styles.saveDisabled]}
            >
              <Text style={styles.saveText}>Ajouter</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Ajouter un élément" style={styles.addRow}>
          <Plus size={18} color={tokens.colors.primary[700]} />
          <Text style={styles.addText}>Ajouter</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.spacing[3] },
  rows: { gap: tokens.spacing[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[3],
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[0],
  },
  rowLabel: { ...tokens.typography.bodyMd, color: tokens.colors.neutral[900], flex: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  badge: { paddingHorizontal: tokens.spacing[2], paddingVertical: 2, borderRadius: tokens.radii.sm },
  badgePlatform: { backgroundColor: tokens.colors.primary[50] },
  badgeCustom: { backgroundColor: tokens.colors.accent[50] },
  badgeText: { ...tokens.typography.bodySm, fontSize: 11 },
  badgeTextPlatform: { color: tokens.colors.primary[700] },
  badgeTextCustom: { color: tokens.colors.accent[700] },
  removeBtn: { padding: tokens.spacing[1] },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[1],
    paddingVertical: tokens.spacing[3],
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.colors.primary[300],
    backgroundColor: tokens.colors.primary[50],
  },
  addText: { ...tokens.typography.button, color: tokens.colors.primary[700] },
  form: {
    gap: tokens.spacing[3],
    padding: tokens.spacing[3],
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.neutral[50],
  },
  groupLabel: { ...tokens.typography.label, color: tokens.colors.neutral[700], marginBottom: tokens.spacing[1] },
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
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: tokens.spacing[2] },
  cancelBtn: { paddingHorizontal: tokens.spacing[4], paddingVertical: tokens.spacing[2] },
  cancelText: { ...tokens.typography.button, color: tokens.colors.neutral[500] },
  saveBtn: {
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[2],
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.primary[600],
  },
  saveDisabled: { backgroundColor: tokens.colors.neutral[300] },
  saveText: { ...tokens.typography.button, color: tokens.colors.neutral[0] },
});
