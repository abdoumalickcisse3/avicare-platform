/**
 * Always-visible sync status ribbon (design direction §6 "Les trois états de
 * synchronisation"). Pure presentational component — no hooks, no side
 * effects — so it is trivially testable; `useSyncStatus` (task 7's other
 * half) supplies the live props from `(field)/_layout.tsx`.
 *
 * Fusion rule (design direction §6 "règle de fusion et sa priorité"): the
 * ribbon shows exactly one phrase, never connectivity and queue separately.
 * Priority, most urgent first: a FAILED row always outranks a pending count
 * — a definitive rejection needs the farmer's action and never clears on its
 * own, so it must never be masked by an in-flight sync.
 */
import { StyleSheet, Text, View } from 'react-native';
import { tokens, type SyncState } from '@/theme';

export type SyncStatusBarProps = {
  online: boolean;
  pending: number;
  failed: number;
  syncing: boolean;
};

type Presentation = { state: SyncState; icon: string; text: string };

function present(pending: number, failed: number): Presentation {
  if (failed > 0) {
    return {
      state: 'failed',
      icon: '!',
      text: failed === 1 ? '1 saisie à corriger' : `${failed} saisies à corriger`,
    };
  }
  if (pending > 0) {
    return {
      state: 'pending',
      icon: '↑',
      text: pending === 1 ? '1 action en attente de sync' : `${pending} actions en attente de sync`,
    };
  }
  return { state: 'synced', icon: '✓', text: 'Tout est synchronisé' };
}

export function SyncStatusBar({ online, pending, failed, syncing }: SyncStatusBarProps) {
  const { state, icon, text } = present(pending, failed);
  const palette = tokens.colors.sync[state];
  // Connectivity has no effect on the single displayed phrase (the fusion
  // rule above already collapses queue + network into one signal), but a
  // screen reader still benefits from the extra context.
  const accessibilityLabel = online ? text : `${text}, hors ligne`;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      style={[styles.container, { backgroundColor: palette.bg }]}
    >
      <View style={[styles.stripe, { backgroundColor: palette.stripe }]} />
      <View style={styles.content}>
        <Text style={[styles.icon, { color: palette.fg }]}>{syncing ? '…' : icon}</Text>
        <Text style={[styles.label, { color: palette.fg }]}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    width: '100%',
    height: tokens.layout.syncRibbonHeight,
    alignItems: 'stretch',
  },
  stripe: {
    width: tokens.layout.syncStripeWidth,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing[4],
    gap: tokens.spacing[2],
  },
  icon: {
    fontSize: tokens.icons.syncBanner,
    fontFamily: tokens.typography.syncLabel.fontFamily,
    fontWeight: tokens.typography.syncLabel.fontWeight,
  },
  label: {
    ...tokens.typography.syncLabel,
  },
});
