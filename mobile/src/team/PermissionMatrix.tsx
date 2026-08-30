/**
 * Per-module access, redesigned for a phone.
 *
 * The web renders a `modules × verbs` grid of checkboxes — six rows, three columns, 88 px each.
 * On five inches that grid is either unreadable or horizontally scrolled, and it is the one
 * screen where a mis-tap silently widens somebody's access.
 *
 * So the axis is turned: one card per module, its verbs as full-size toggle chips underneath,
 * and a summary line that answers the question the operator actually has — *what can this person
 * do here?* — without decoding a row of checkmarks.
 *
 * The verbs come from `catalog.resources[].verbs`, never a hardcoded list. The web's fixed
 * read/write/delete triplet is why `inventory:consume` has no column there.
 */
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, tokens } from '@/theme';
import { grantedCount, toggleVerb, verbLabel } from './permissions';
import type { PermissionCatalog } from '@/types';
import { Chip } from './Chip';

export function PermissionMatrix({
  catalog,
  selected,
  disabled,
  onChange,
}: {
  catalog: PermissionCatalog;
  /** Expanded `resource:verb` set. */
  selected: Set<string>;
  disabled?: boolean;
  onChange: (next: string[]) => void;
}) {
  return (
    <View style={styles.wrap}>
      {catalog.resources.map((r) => {
        const granted = grantedCount(selected, r.resource, r.verbs);
        const summary =
          granted === 0
            ? 'Aucun accès'
            : r.verbs
                .filter((v) => selected.has(`${r.resource}:${v}`))
                .map(verbLabel)
                .join(' · ');

        return (
          <View key={r.resource} style={[styles.module, granted === 0 && styles.moduleOff]}>
            <View style={styles.head}>
              <Text style={styles.moduleLabel}>{r.label}</Text>
              <Text style={[styles.summary, granted === 0 && styles.summaryOff]}>{summary}</Text>
            </View>

            <View style={styles.chips}>
              {r.verbs.map((v) => {
                const on = selected.has(`${r.resource}:${v}`);
                return (
                  <Chip
                    key={v}
                    label={verbLabel(v)}
                    active={on}
                    disabled={disabled}
                    accessibilityLabel={`${r.label} — ${verbLabel(v)}`}
                    onPress={() =>
                      onChange(toggleVerb(selected, r.resource, v, !on, r.verbs))
                    }
                  />
                );
              })}
            </View>
          </View>
        );
      })}

      <Text style={styles.foot}>
        « Saisir » et « Supprimer » donnent aussi « Voir » : l&apos;application n&apos;affiche un
        écran que si le membre peut le voir. « Consommer » fait exception — l&apos;aliment se
        décompte depuis la saisie journalière, sans ouvrir le stock.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.spacing[3] },
  module: {
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    backgroundColor: tokens.colors.neutral[0],
    padding: tokens.spacing[3],
    gap: tokens.spacing[2],
  },
  moduleOff: { backgroundColor: tokens.colors.neutral[50] },
  head: { gap: 2 },
  moduleLabel: {
    ...tokens.typography.bodyMd,
    fontFamily: fontFamily.sansSemiBold,
    color: tokens.colors.field.text,
  },
  summary: { ...tokens.typography.bodySm, color: tokens.colors.primary[700] },
  summaryOff: { color: tokens.colors.field.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  foot: {
    ...tokens.typography.bodySm,
    color: tokens.colors.field.textMuted,
    lineHeight: 18,
  },
});
