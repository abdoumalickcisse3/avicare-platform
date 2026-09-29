/**
 * Always-visible sync status ribbon (design direction §6 "Les trois états de
 * synchronisation"). Pure presentational component — no hooks, no side
 * effects — so it is trivially testable; `useSyncStatus` (task 7's other
 * half) supplies the live props from `(field)/_layout.tsx`.
 *
 * Fusion rule (design direction §6 "règle de fusion et sa priorité"): the
 * ribbon shows exactly one phrase, never connectivity and queue separately.
 * Priority, most urgent first: a FAILED row always outranks everything
 * — a definitive rejection needs the farmer's action and never clears on its
 * own, so it must never be masked by an in-flight sync — then offline, then
 * a pending count.
 *
 * Online with nothing queued renders NOTHING. A ribbon that permanently says
 * "all good" stops being read, costs 44px of a small screen, and (as it once
 * did) ends up saying "all synced" while the phone has no network at all.
 */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { tokens, type SyncState } from '@/theme';

export type SyncStatusBarProps = {
  online: boolean;
  pending: number;
  failed: number;
  syncing: boolean;
  /**
   * When provided, the whole ribbon becomes a button that opens the queue
   * screen (`(field)/file`), so a farmer can act on a "à corriger" straight
   * from the banner. Left unset the ribbon stays a passive, presentational
   * indicator (the default in tests).
   */
  onPress?: () => void;
};

type Presentation = { state: SyncState; icon: string; text: string };

function present(online: boolean, pending: number, failed: number): Presentation | null {
  if (failed > 0) {
    return {
      state: 'failed',
      icon: '!',
      text: failed === 1 ? '1 saisie à corriger' : `${failed} saisies à corriger`,
    };
  }
  if (!online) {
    return {
      state: 'offline',
      icon: '⌀',
      text:
        pending === 0
          ? 'Hors ligne — vos saisies sont gardées'
          : pending === 1
            ? 'Hors ligne · 1 action en attente'
            : `Hors ligne · ${pending} actions en attente`,
    };
  }
  if (pending > 0) {
    return {
      state: 'pending',
      icon: '↑',
      text: pending === 1 ? '1 action en attente de sync' : `${pending} actions en attente de sync`,
    };
  }
  return null;
}

export function SyncStatusBar({ online, pending, failed, syncing, onPress }: SyncStatusBarProps) {
  const shown = present(online, pending, failed);
  if (!shown) return null;
  const { state, icon, text } = shown;
  const palette = tokens.colors.sync[state];
  // A failure phrase does not mention the network, so a screen reader gets it appended.
  const accessibilityLabel = online || state === 'offline' ? text : `${text}, hors ligne`;

  const body = (
    <>
      <View style={[styles.stripe, { backgroundColor: palette.stripe }]} />
      <View style={styles.content}>
        <Text style={[styles.icon, { color: palette.fg }]}>{syncing ? '…' : icon}</Text>
        <Text style={[styles.label, { color: palette.fg }]}>{text}</Text>
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Voir les saisies en attente"
        onPress={onPress}
        style={[styles.container, { backgroundColor: palette.bg }]}
      >
        {body}
      </TouchableOpacity>
    );
  }

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      style={[styles.container, { backgroundColor: palette.bg }]}
    >
      {body}
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
