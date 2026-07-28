/**
 * Section heading for consultation screens — a title with an optional trailing
 * action ("Voir tout"). Mirrors the web dashboard's section headers so the two
 * apps share the same rhythm.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '@/theme';

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing[3],
  },
  title: {
    ...tokens.typography.headingMd,
    color: tokens.colors.field.text,
  },
});
