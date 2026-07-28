/**
 * Feed-source selector for the daily entry — the mobile equivalent of the web
 * `FeedSourceSection`. Three exclusive modes: no coupling, a single stock
 * article (D18), or a feed formula decomposed into per-ingredient OUT
 * movements (D20 révisée). Emits at most one of the two payloads through
 * `onChange`. Shown only when the inventory module returns data (empty → the
 * pickers show an empty note). Non-blocking on insufficient stock (D19): the
 * resulting quantity is shown in red but never prevents submission.
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { tokens } from '@/theme';
import { useGetStockItemsQuery } from '@/store/api/inventoryStockApi';
import { useGetAvailableFormulasQuery } from '@/store/api/feedFormulasApi';
import { formatNumber } from '@/lib/format';
import type { FeedFormulaRef, StockConsumption } from '@/types';

type Mode = 'none' | 'article' | 'formula';

function articleLabel(key: string): string {
  const s = key.replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toNum(v: string): number {
  const n = v.trim() ? Number(v.trim().replace(',', '.')) : NaN;
  return Number.isFinite(n) ? n : NaN;
}

export function FeedSourceSection({
  farmId,
  onChange,
}: {
  farmId: number;
  onChange: (feedConsumption: StockConsumption | null, feedFormula: FeedFormulaRef | null) => void;
}) {
  const arg = { farmId };
  const { data: stockItems } = useGetStockItemsQuery(farmId ? arg : skipToken);
  const { data: available } = useGetAvailableFormulasQuery(farmId ? arg : skipToken);

  const [mode, setMode] = useState<Mode>('none');
  const [articleKey, setArticleKey] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [formula, setFormula] = useState<{ key?: string; id?: number; label: string } | null>(null);
  const [totalKg, setTotalKg] = useState('');

  const feedItems = useMemo(
    () => (stockItems ?? []).filter((i) => i.active && i.articleSource === 'INVENTORY'),
    [stockItems],
  );
  const formulaOptions = useMemo<Array<{ key?: string; id?: number; label: string }>>(
    () => [
      ...(available?.farmFormulas ?? []).map((f) => ({ id: f.id, label: f.name })),
      ...(available?.platformFormulas ?? []).map((p) => ({ key: p.key, label: p.label })),
    ],
    [available],
  );

  const selectedStock = feedItems.find((i) => i.articleKey === articleKey);

  function emit(m: Mode, aKey: string | null, q: string, f: typeof formula, kg: string) {
    if (m === 'article' && aKey) {
      const n = toNum(q);
      const src = feedItems.find((i) => i.articleKey === aKey);
      if (src && n > 0) return onChange({ articleKey: aKey, articleSource: src.articleSource, quantity: n }, null);
    } else if (m === 'formula' && f) {
      const n = toNum(kg);
      if (n > 0) return onChange(null, { ...(f.key ? { formulaKey: f.key } : { formulaId: f.id }), totalKg: n });
    }
    onChange(null, null);
  }

  function pickMode(m: Mode) {
    setMode(m);
    emit(m, articleKey, qty, formula, totalKg);
  }

  const afterStock = selectedStock && toNum(qty) > 0 ? selectedStock.currentQuantity - toNum(qty) : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Aliment depuis le stock (facultatif)</Text>

      <View style={styles.modes}>
        {(['none', 'article', 'formula'] as const).map((m) => {
          const on = mode === m;
          const label = m === 'none' ? 'Aucun' : m === 'article' ? 'Article' : 'Formule';
          return (
            <Pressable key={m} style={[styles.modeChip, on && styles.modeChipOn]} onPress={() => pickMode(m)} accessibilityRole="button">
              <Text style={[styles.modeText, on && styles.modeTextOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {mode === 'article' && (
        <View style={styles.block}>
          {feedItems.length === 0 ? (
            <Text style={styles.empty}>Aucun article d&apos;aliment en stock.</Text>
          ) : (
            <View style={styles.pickerChips}>
              {feedItems.map((i) => {
                const on = i.articleKey === articleKey;
                return (
                  <Pressable
                    key={i.id}
                    style={[styles.pickChip, on && styles.pickChipOn]}
                    onPress={() => { setArticleKey(i.articleKey); emit('article', i.articleKey, qty, formula, totalKg); }}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.pickText, on && styles.pickTextOn]}>{articleLabel(i.articleKey)}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {articleKey ? (
            <>
              <View style={styles.qtyRow}>
                <TextInput
                  style={styles.qtyInput}
                  value={qty}
                  onChangeText={(t) => { setQty(t); emit('article', articleKey, t, formula, totalKg); }}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  placeholder="Quantité"
                  placeholderTextColor={tokens.colors.field.disabled}
                />
                <Text style={styles.unit}>{selectedStock?.unit ?? 'kg'}</Text>
              </View>
              {afterStock != null ? (
                <Text style={[styles.after, afterStock < 0 && styles.afterNeg]}>
                  Stock après : {formatNumber(afterStock)} {selectedStock?.unit ?? 'kg'}
                  {afterStock < 0 ? ' (insuffisant)' : ''}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>
      )}

      {mode === 'formula' && (
        <View style={styles.block}>
          {formulaOptions.length === 0 ? (
            <Text style={styles.empty}>Aucune formule disponible.</Text>
          ) : (
            <View style={styles.pickerChips}>
              {formulaOptions.map((f) => {
                const on = formula?.label === f.label;
                return (
                  <Pressable
                    key={f.key ?? f.id}
                    style={[styles.pickChip, on && styles.pickChipOn]}
                    onPress={() => { setFormula(f); emit('formula', articleKey, qty, f, totalKg); }}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.pickText, on && styles.pickTextOn]}>{f.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {formula ? (
            <View style={styles.qtyRow}>
              <TextInput
                style={styles.qtyInput}
                value={totalKg}
                onChangeText={(t) => { setTotalKg(t); emit('formula', articleKey, qty, formula, t); }}
                keyboardType="decimal-pad"
                inputMode="decimal"
                placeholder="Total distribué"
                placeholderTextColor={tokens.colors.field.disabled}
              />
              <Text style={styles.unit}>kg</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderColor: tokens.colors.neutral[200], borderRadius: tokens.radii.lg, padding: tokens.spacing[4], gap: tokens.spacing[3], backgroundColor: tokens.colors.neutral[0] },
  title: { ...tokens.typography.bodySm, fontWeight: '600', color: tokens.colors.field.text },
  modes: { flexDirection: 'row', gap: tokens.spacing[2] },
  modeChip: { flex: 1, alignItems: 'center', paddingVertical: tokens.spacing[2], borderRadius: tokens.radii.full, backgroundColor: tokens.colors.neutral[100] },
  modeChipOn: { backgroundColor: tokens.colors.primary[600] },
  modeText: { ...tokens.typography.bodySm, fontWeight: '600', color: tokens.colors.field.textMuted },
  modeTextOn: { color: tokens.colors.neutral[0] },
  block: { gap: tokens.spacing[3] },
  empty: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  pickerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  pickChip: { paddingHorizontal: tokens.spacing[3], paddingVertical: tokens.spacing[2], borderRadius: tokens.radii.full, borderWidth: 1, borderColor: tokens.colors.neutral[300], backgroundColor: tokens.colors.neutral[50] },
  pickChipOn: { backgroundColor: tokens.colors.primary[50], borderColor: tokens.colors.primary[600] },
  pickText: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  pickTextOn: { color: tokens.colors.primary[700], fontWeight: '600' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], borderWidth: 1, borderColor: tokens.colors.neutral[300], borderRadius: tokens.radii.md, paddingHorizontal: tokens.spacing[3], backgroundColor: tokens.colors.neutral[50] },
  qtyInput: { flex: 1, ...tokens.typography.bodyLg, color: tokens.colors.field.text, minHeight: tokens.touch.field },
  unit: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
  after: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  afterNeg: { color: tokens.colors.error },
});
