/**
 * Receive a purchase order, line by line — the third "desktop" screen this lot redesigns.
 *
 * The web offers an editable table; the app until now offered a single "receive everything at the
 * ordered quantity" button, which is a lie whenever the supplier delivered short.
 *
 * Two backend facts the operator has to be told, because neither is guessable and both are
 * irreversible:
 *
 *   - **Reception closes the order.** The service sets RECEIVED unconditionally — there is no
 *     partially-received state — so whatever is not entered now can never be received on this
 *     order. That sentence is on the screen, not in a tooltip.
 *   - **It books an expense.** received × unit price goes to the finance ledger, so this screen
 *     moves money, and the total is shown before the button is pressed.
 *
 * Each line starts at the ordered quantity, because "everything arrived" is the common case; the
 * work is correcting the two lines that came up short.
 */
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fontFamily, tokens } from '@/theme';
import { FormField } from '@/components/field/FormField';
import { formatCurrency, formatNumber } from '@/lib/format';
import type { PurchaseOrder } from '@/types';

export type ReceptionLine = { itemId: number; receivedQuantity: number };

/** `feed_layer` → "Feed layer": order lines carry a key, not a label. */
function articleLabel(key: string): string {
  const s = key.replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function ReceptionSheet({
  open,
  order,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  order: PurchaseOrder | undefined;
  saving: boolean;
  onClose: () => void;
  onSubmit: (lines: ReceptionLine[]) => void;
}) {
  const [received, setReceived] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!open || !order) return;
    const next: Record<number, string> = {};
    for (const item of order.items) next[item.id] = String(item.orderedQuantity);
    setReceived(next);
  }, [open, order]);

  const items = order?.items ?? [];

  const lines: ReceptionLine[] = items.map((item) => {
    const raw = received[item.id] ?? '';
    const value = Number(raw.replace(',', '.'));
    return { itemId: item.id, receivedQuantity: Number.isFinite(value) && value > 0 ? value : 0 };
  });

  const shortLines = items.filter((item, index) => {
    const line = lines[index];
    return line != null && line.receivedQuantity < item.orderedQuantity;
  });

  const total = useMemo(
    () =>
      items.reduce((sum, item, index) => {
        const line = lines[index];
        if (!line || item.unitPriceXof == null) return sum;
        return sum + line.receivedQuantity * item.unitPriceXof;
      }, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, received],
  );

  const anyReceived = lines.some((l) => l.receivedQuantity > 0);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Fermer" onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Réception</Text>
        <Text style={styles.subtitle}>{order?.orderNumber}</Text>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Chaque ligne est pré-remplie avec la quantité commandée. Corrigez celles qui sont
            arrivées incomplètes.
          </Text>

          {items.map((item) => {
            const ordered = item.orderedQuantity;
            const raw = received[item.id] ?? '';
            const value = Number(raw.replace(',', '.'));
            const short = Number.isFinite(value) && value < ordered;
            return (
              <View key={item.id} style={styles.line}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineName} numberOfLines={1}>
                    {articleLabel(item.articleKey)}
                  </Text>
                  <Text style={styles.lineOrdered}>
                    Commandé : {formatNumber(ordered)}
                    {item.unit ? ` ${item.unit}` : ''}
                  </Text>
                  {short ? (
                    <Text style={styles.lineShort}>
                      Manque {formatNumber(ordered - (Number.isFinite(value) ? value : 0))}
                    </Text>
                  ) : null}
                </View>
                <FormField
                  label=""
                  value={raw}
                  onChangeText={(t) => setReceived((r) => ({ ...r, [item.id]: t }))}
                  keyboardType="decimal-pad"
                  style={styles.qtyInput}
                  accessibilityLabel={`Quantité reçue ${articleLabel(item.articleKey)}`}
                />
              </View>
            );
          })}

          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Dépense enregistrée</Text>
            <Text style={styles.totalValue}>{formatCurrency(Math.round(total))}</Text>
            <Text style={styles.totalHint}>
              La réception écrit cette dépense dans votre comptabilité.
            </Text>
          </View>

          {shortLines.length > 0 ? (
            <View style={styles.warnBox}>
              <Text style={styles.warnText}>
                {shortLines.length === 1
                  ? 'Une ligne est incomplète.'
                  : `${shortLines.length} lignes sont incomplètes.`}{' '}
                Le bon sera clôturé : ce qui manque ne pourra plus être reçu dessus. Créez un
                nouveau bon si le fournisseur livre le reste plus tard.
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Annuler"
            style={styles.cancel}
          >
            <Text style={styles.cancelText}>Annuler</Text>
          </Pressable>
          <Pressable
            onPress={() => anyReceived && !saving && onSubmit(lines)}
            disabled={!anyReceived || saving}
            accessibilityRole="button"
            accessibilityLabel="Valider la réception"
            style={[styles.save, (!anyReceived || saving) && styles.disabled]}
          >
            <Text style={styles.saveText}>{saving ? 'Réception…' : 'Valider la réception'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28, 25, 23, 0.45)' },
  sheet: {
    backgroundColor: tokens.colors.field.background,
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    paddingTop: tokens.spacing[5],
    maxHeight: '92%',
  },
  title: {
    ...tokens.typography.headingLg,
    color: tokens.colors.field.text,
    paddingHorizontal: tokens.layout.screenPadding,
  },
  subtitle: {
    ...tokens.typography.bodySm,
    color: tokens.colors.field.textMuted,
    paddingHorizontal: tokens.layout.screenPadding,
    marginBottom: tokens.spacing[2],
  },
  content: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingBottom: tokens.spacing[4],
    gap: tokens.spacing[3],
  },
  intro: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, lineHeight: 18 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    backgroundColor: tokens.colors.neutral[0],
    padding: tokens.spacing[3],
  },
  lineName: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  lineOrdered: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  lineShort: {
    ...tokens.typography.bodySm,
    color: tokens.colors.warningDark,
    fontFamily: fontFamily.sansSemiBold,
  },
  qtyInput: { width: 96 },
  totalBox: {
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.neutral[0],
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    padding: tokens.spacing[3],
    gap: 2,
  },
  totalLabel: { ...tokens.typography.label, color: tokens.colors.field.textMuted },
  totalValue: { ...tokens.typography.numericSm, color: tokens.colors.field.text },
  totalHint: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, lineHeight: 18 },
  warnBox: {
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.warningLight,
    padding: tokens.spacing[3],
  },
  warnText: { ...tokens.typography.bodySm, color: tokens.colors.warningDark, lineHeight: 19 },
  actions: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[3],
    paddingBottom: tokens.spacing[6],
    borderTopWidth: 1,
    borderTopColor: tokens.colors.field.ruleSubtle,
  },
  cancel: {
    minHeight: tokens.touch.primaryButton,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[6],
  },
  cancelText: { ...tokens.typography.button, color: tokens.colors.field.textMuted },
  save: {
    flex: 1,
    minHeight: tokens.touch.primaryButton,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.action.commit.bg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.commit.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  saveText: { ...tokens.typography.button, color: tokens.colors.action.commit.fg },
});
