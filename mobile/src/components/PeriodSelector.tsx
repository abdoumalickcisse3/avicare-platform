/**
 * The window the KPIs are read through.
 *
 * Three choices, not a date range picker: a farmer comparing this week to last does not want to
 * pick two dates on a phone, and the backend takes a `period` token anyway.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fontFamily, tokens } from '@/theme';
import {
  PERIOD_LABELS,
  selectPeriod,
  setPeriod,
  type DashboardPeriod,
} from '@/store/slices/selectionSlice';

const PERIODS: DashboardPeriod[] = ['7d', '30d', '90d'];

export function PeriodSelector() {
  const period = useSelector(selectPeriod);
  const dispatch = useDispatch();

  return (
    <View style={styles.row} accessibilityLabel="Période affichée">
      {PERIODS.map((p) => {
        const active = p === period;
        return (
          <Pressable
            key={p}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Période ${PERIOD_LABELS[p]}`}
            onPress={() => dispatch(setPeriod(p))}
            style={[styles.chip, active && styles.chipOn]}
          >
            <Text style={[styles.text, active && styles.textOn]}>{PERIOD_LABELS[p]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: tokens.spacing[2], marginBottom: tokens.spacing[3] },
  chip: {
    minHeight: tokens.touch.min,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[4],
    borderRadius: tokens.radii.full,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    backgroundColor: tokens.colors.neutral[0],
  },
  chipOn: { backgroundColor: tokens.colors.field.text, borderColor: tokens.colors.field.text },
  text: { ...tokens.typography.bodySm, color: tokens.colors.field.text },
  textOn: { color: tokens.colors.neutral[0], fontFamily: fontFamily.sansSemiBold },
});
