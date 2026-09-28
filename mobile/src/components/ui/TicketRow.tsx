/**
 * Bande "ticket de caisse" : 2 à 4 chiffres de même rang, séparés par un fin trait vertical.
 * Remplace toute grille de cartes KPI bordées à ombre (doc
 * docs/superpowers/specs/2026-09-22-mobile-ux-refonte-champ-design.md §2 règle 2).
 *
 * `variant="flat"` drops the border/background/margin — for nesting inside a row that already
 * carries its own divider (e.g. a list row on Élevage), where the default card chrome would read
 * as a card inside a card.
 */
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '@/theme';

export interface TicketItem {
  key: string;
  value: string;
  label: string;
  /**
   * Couleur de la valeur seule. Convention commune à tout l'app : `tokens.colors.error` pour un
   * fait déjà mauvais (mortalité, stock négatif — quelque chose qui s'est déjà produit) ;
   * `tokens.colors.accent[400]` pour ce qui demande une action (créance à recouvrer, stock bas,
   * commande en retard) ; omis pour une valeur neutre ou déjà favorable. Ne jamais teinter une
   * valeur saine juste pour occuper la colonne — une teinte permanente cesse d'être un signal.
   */
  tint?: string;
}

interface TicketRowProps {
  items: TicketItem[];
  /** 'card' (default) or 'flat' — see the file-level comment. */
  variant?: 'card' | 'flat';
}

export function TicketRow({ items, variant = 'card' }: TicketRowProps) {
  return (
    <View style={[styles.row, variant === 'flat' && styles.rowFlat]}>
      {items.map((item, i) => (
        <View key={item.key} style={[styles.cell, i > 0 && styles.cellDivider]}>
          <Text
            style={[styles.value, item.tint ? { color: item.tint } : null]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
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
    marginBottom: tokens.spacing[4],
  },
  rowFlat: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingVertical: 0,
    marginBottom: 0,
  },
  cell: { flex: 1, alignItems: 'center', gap: 2 },
  cellDivider: { borderLeftWidth: 1, borderLeftColor: tokens.colors.neutral[200] },
  value: { ...tokens.typography.numericSm, fontSize: 20, color: tokens.colors.field.text },
  label: { ...tokens.typography.bodySm, fontSize: 11, color: tokens.colors.field.textMuted },
});
