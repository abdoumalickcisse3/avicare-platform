/**
 * One article's stock detail — the first of the three "desktop" screens this lot redesigns.
 *
 * The web puts a chart and three dense tables here, with raw columns (`dailyRecordId`,
 * `vaccinationId`, `purchaseOrderId`) that leave the reader to work out where each line came
 * from. None of that survives a five-inch screen.
 *
 * What replaces it follows the order the questions are actually asked in a barn:
 *
 *   1. How much is left, and is that a lot or a little?  → the number, then days of cover
 *   2. When do I need to reorder?                        → the threshold, editable here
 *   3. Where did it go?                                  → the ledger, one sentence per line
 *
 * "Days of cover" is the addition the web does not have. "42 sacs" means nothing until you know
 * whether it is a week or two months, and the movements already hold the consumption rate.
 */
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft, Bell, Package, Plus } from 'lucide-react-native';
import { fontFamily, tokens } from '@/theme';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import {
  useDeactivateStockItemMutation,
  useGetMovementsByItemQuery,
  useGetStockItemQuery,
  useUpdateStockThresholdMutation,
} from '@/store/api/inventoryStockApi';
import { StockMovementSheet } from '@/inventory/StockMovementSheet';
import { ThresholdSheet } from '@/inventory/ThresholdSheet';
import { daysOfCover, groupByMonth, movementOrigin, reasonLabel, signedQuantity } from '@/inventory/movements';
import { formatCurrency, formatNumber } from '@/lib/format';

/** `feed_layer` → "Feed layer": the stock row carries no label snapshot. */
function articleLabel(key: string): string {
  const s = key.replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export default function StockItemScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const id = Number(itemId);
  const router = useRouter();
  const farmId = useSelector(selectSelectedFarmId);
  const { can } = useFarmAccess();
  const canWrite = can('inventory:write');

  const [movementOpen, setMovementOpen] = useState(false);
  const [thresholdOpen, setThresholdOpen] = useState(false);

  const { data: item, isLoading } = useGetStockItemQuery(
    farmId === null || !Number.isFinite(id) ? skipToken : { farmId, id },
  );
  const { data: movements = [] } = useGetMovementsByItemQuery(
    farmId === null || !Number.isFinite(id) ? skipToken : { farmId, stockItemId: id },
  );

  const [updateThreshold, { isLoading: savingThreshold }] = useUpdateStockThresholdMutation();
  const [deactivate] = useDeactivateStockItemMutation();

  const groups = useMemo(() => groupByMonth(movements), [movements]);
  const cover = useMemo(
    () => (item ? daysOfCover(item.currentQuantity, movements) : null),
    [item, movements],
  );

  if (farmId === null) return <Redirect href="/(field)" />;

  const name = item ? articleLabel(item.articleKey) : 'Article';
  const low =
    item != null && item.alertThreshold != null && item.currentQuantity <= item.alertThreshold;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          onPress={() => router.back()}
          style={styles.back}
        >
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>
          {name}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading || !item ? (
          <Text style={styles.muted}>Chargement…</Text>
        ) : (
          <>
            {/* 1. How much is left. */}
            <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.hero}>
              <Text style={[styles.quantity, low && styles.quantityLow]}>
                {formatNumber(item.currentQuantity)}
                <Text style={styles.unit}>{item.unit ? ` ${item.unit}` : ''}</Text>
              </Text>
              {cover != null ? (
                <Text style={styles.cover}>
                  Environ {cover} jour{cover > 1 ? 's' : ''} de couverture au rythme du dernier
                  mois.
                </Text>
              ) : (
                <Text style={styles.coverMuted}>
                  Pas assez de sorties récentes pour estimer une couverture.
                </Text>
              )}
              {item.typicalUnitPriceXof != null ? (
                <Text style={styles.value}>
                  Valeur ≈ {formatCurrency(item.currentQuantity * item.typicalUnitPriceXof)}
                </Text>
              ) : null}
            </Animated.View>

            {/* 2. When to reorder. */}
            <Pressable
              accessibilityRole={canWrite ? 'button' : undefined}
              accessibilityLabel={canWrite ? "Modifier le seuil d'alerte" : undefined}
              disabled={!canWrite}
              onPress={() => setThresholdOpen(true)}
              style={[styles.thresholdRow, low && styles.thresholdRowLow]}
            >
              <Bell size={18} color={low ? tokens.colors.errorDark : tokens.colors.field.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.thresholdLabel}>Seuil d&apos;alerte</Text>
                <Text style={styles.thresholdValue}>
                  {item.alertThreshold != null
                    ? `${formatNumber(item.alertThreshold)}${item.unit ? ` ${item.unit}` : ''}`
                    : 'Aucun seuil défini'}
                </Text>
              </View>
              {low ? <Text style={styles.lowTag}>Sous le seuil</Text> : null}
            </Pressable>

            {canWrite ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Enregistrer un mouvement"
                onPress={() => setMovementOpen(true)}
                style={styles.primaryBtn}
              >
                <Plus size={18} color={tokens.colors.action.accumulate.fg} />
                <Text style={styles.primaryText}>Enregistrer un mouvement</Text>
              </Pressable>
            ) : null}

            {/* 3. Where it went. */}
            <Text style={styles.sectionTitle}>Historique</Text>
            {groups.length === 0 ? (
              <View style={styles.empty}>
                <Package size={26} color={tokens.colors.primary[600]} />
                <Text style={styles.emptyText}>Aucun mouvement enregistré.</Text>
              </View>
            ) : (
              groups.map((group) => (
                <View key={group.key} style={styles.group}>
                  <Text style={styles.groupLabel}>{group.label}</Text>
                  {group.movements.map((m) => {
                    const delta = signedQuantity(m);
                    return (
                      <View key={m.id} style={styles.row}>
                        <Text style={styles.rowDate}>{dayMonth(m.movementDate)}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowReason}>{reasonLabel(m.reason)}</Text>
                          <Text style={styles.rowOrigin}>{movementOrigin(m)}</Text>
                        </View>
                        <View style={styles.rowRight}>
                          <Text style={[styles.rowDelta, delta < 0 ? styles.out : styles.in]}>
                            {delta > 0 ? '+' : ''}
                            {formatNumber(delta)}
                          </Text>
                          {/* The running balance is why this reads as a ledger and not a list. */}
                          <Text style={styles.rowAfter}>
                            reste {formatNumber(m.quantityAfter)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))
            )}

            {canWrite ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Archiver cet article"
                onPress={() =>
                  Alert.alert(
                    `Archiver ${name} ?`,
                    "L'article disparaît de la liste des stocks. Son historique reste consultable, et rien de ce qui a été consommé n'est effacé.",
                    [
                      { text: 'Annuler', style: 'cancel' },
                      {
                        text: 'Archiver',
                        style: 'destructive',
                        onPress: async () => {
                          await deactivate({ farmId, id });
                          router.back();
                        },
                      },
                    ],
                  )
                }
                style={styles.archive}
              >
                <Text style={styles.archiveText}>Archiver cet article</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>

      {item ? (
        <>
          <StockMovementSheet
            farmId={farmId}
            item={item}
            name={name}
            open={movementOpen}
            onClose={() => setMovementOpen(false)}
            onDone={() => setMovementOpen(false)}
          />
          <ThresholdSheet
            open={thresholdOpen}
            itemName={name}
            unit={item.unit}
            currentQuantity={item.currentQuantity}
            currentThreshold={item.alertThreshold}
            saving={savingThreshold}
            onClose={() => setThresholdOpen(false)}
            onSubmit={async (threshold) => {
              await updateThreshold({ farmId, id, threshold });
              setThresholdOpen(false);
            }}
          />
        </>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    paddingHorizontal: tokens.spacing[2],
    paddingVertical: tokens.spacing[2],
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { ...tokens.typography.headingMd, color: tokens.colors.field.text, flex: 1 },
  content: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingBottom: tokens.spacing[16],
    gap: tokens.spacing[3],
  },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },

  hero: {
    borderRadius: tokens.radii.xl,
    backgroundColor: tokens.colors.neutral[0],
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    padding: tokens.spacing[4],
    gap: tokens.spacing[1],
  },
  quantity: { ...tokens.typography.numeric, color: tokens.colors.field.text },
  quantityLow: { color: tokens.colors.errorDark },
  unit: { fontFamily: fontFamily.sansSemiBold, fontSize: 20, color: tokens.colors.field.textMuted },
  cover: { ...tokens.typography.bodyMd, color: tokens.colors.primary[700], lineHeight: 21 },
  coverMuted: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, lineHeight: 18 },
  value: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },

  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    minHeight: tokens.touch.button,
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    backgroundColor: tokens.colors.neutral[0],
    padding: tokens.spacing[3],
  },
  thresholdRowLow: { borderColor: tokens.colors.errorDark, backgroundColor: tokens.colors.errorLight },
  thresholdLabel: { ...tokens.typography.label, color: tokens.colors.field.textMuted },
  thresholdValue: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  lowTag: { ...tokens.typography.bodySm, color: tokens.colors.errorDark, fontFamily: fontFamily.sansSemiBold },

  primaryBtn: {
    minHeight: tokens.touch.primaryButton,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[2],
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.action.accumulate.bg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.accumulate.border,
  },
  primaryText: { ...tokens.typography.button, color: tokens.colors.action.accumulate.fg },

  sectionTitle: {
    ...tokens.typography.headingMd,
    color: tokens.colors.field.text,
    marginTop: tokens.spacing[2],
  },
  empty: { alignItems: 'center', gap: tokens.spacing[2], paddingVertical: tokens.spacing[6] },
  emptyText: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
  group: { gap: tokens.spacing[1] },
  groupLabel: {
    ...tokens.typography.label,
    color: tokens.colors.field.textMuted,
    marginTop: tokens.spacing[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingVertical: tokens.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.field.ruleSubtle,
  },
  rowDate: {
    ...tokens.typography.bodySm,
    color: tokens.colors.field.textMuted,
    width: 44,
    fontVariant: ['tabular-nums'],
  },
  rowReason: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  rowOrigin: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  rowRight: { alignItems: 'flex-end' },
  rowDelta: {
    ...tokens.typography.bodyMd,
    fontFamily: fontFamily.sansSemiBold,
    fontVariant: ['tabular-nums'],
  },
  in: { color: tokens.colors.successDark },
  out: { color: tokens.colors.errorDark },
  rowAfter: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },

  archive: {
    minHeight: tokens.touch.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing[4],
  },
  archiveText: { ...tokens.typography.button, color: tokens.colors.errorDark },
});
