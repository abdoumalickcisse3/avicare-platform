/**
 * Bande "ticket de caisse" : 2 à 4 chiffres de même rang, séparés par un fin trait vertical.
 * Remplace toute grille de cartes KPI bordées à ombre (doc
 * docs/superpowers/specs/2026-09-22-mobile-ux-refonte-champ-design.md §2 règle 2).
 */
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '@/theme';

export interface TicketItem {
  key: string;
  value: string;
  label: string;
  /** Couleur de la valeur seule — ex. tokens.colors.accent[400] pour une alerte. */
  tint?: string;
}

interface TicketRowProps {
  items: TicketItem[];
}

export function TicketRow({ items }: TicketRowProps) {
  return (
    <View style={styles.row}>
      {items.map((item, i) => (
        <View key={item.key} style={[styles.cell, i > 0 && styles.cellDivider]}>
          <Text style={[styles.value, item.tint ? { color: item.tint } : null]} numberOfLines={1}>
            {item.value}
          </Text>
          <Text style={styles.label} numberOfLines={1}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.neutral[0],
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    borderRadius: tokens.radii.xl,
    paddingVertical: tokens.spacing[3],
  },
  cell: { flex: 1, alignItems: 'center', gap: 2 },
  cellDivider: { borderLeftWidth: 1, borderLeftColor: tokens.colors.neutral[200] },
  value: { ...tokens.typography.numericSm, fontSize: 20, color: tokens.colors.field.text },
  label: { ...tokens.typography.bodySm, fontSize: 11, color: tokens.colors.field.textMuted },
});
