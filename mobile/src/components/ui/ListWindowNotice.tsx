/**
 * Says so when the backend served only a window of a long list, instead of letting the screen pass
 * off the 500 newest rows as the whole history. Renders nothing for a list served whole, which is
 * every list on a farm that has not been running for years.
 *
 * Deliberately calm — a bordered note, not a sync ribbon: nothing is wrong, and the state that
 * shouts is reserved for work that failed to leave the phone.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { selectListWindow } from '@/store/slices/listWindowSlice';
import { tokens } from '@/theme';

const nf = new Intl.NumberFormat('fr-FR');

export function ListWindowNotice({ endpoint }: { endpoint: string }) {
  const window = useSelector(selectListWindow(endpoint));
  if (!window) return null;

  return (
    <View style={styles.note}>
      <Text style={styles.text}>
        Les {nf.format(window.size)} lignes les plus récentes sont affichées, sur{' '}
        {nf.format(window.total)} au total.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.field.rule,
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing[2],
    paddingHorizontal: tokens.spacing[3],
    marginBottom: tokens.spacing[3],
  },
  text: {
    ...tokens.typography.bodySm,
    color: tokens.colors.field.textMuted,
  },
});
