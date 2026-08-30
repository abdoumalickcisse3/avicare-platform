/**
 * The thumb-zone action bar of the field design, finally built.
 *
 * `layout.actionBarHeight` (88dp) and `layout.thumbZoneRatio` (0.35) have described it in
 * the tokens since the field design was written, with nothing using them.
 *
 * Two decisions worth stating, because both are structural rather than stylistic:
 *
 * - **One child.** Design direction §6 calls a single `commit` action per screen the golden
 *   rule; a component that accepts exactly one child makes that rule impossible to break by
 *   accident, where a comment saying "only one, please" would eventually be ignored.
 * - **The bottom inset is respected.** On a phone with a gesture bar, a button flush against
 *   the edge is a button whose bottom third belongs to the system — so it is a button people
 *   miss, then press again, then press twice.
 *
 * The background is opaque so scrolling content passes behind it rather than through it: a
 * value half-visible under a translucent bar is a value someone will misread.
 */
import { useContext, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { tokens } from '@/theme';

export function ActionBar({ children }: { children: ReactNode }) {
  // `useSafeAreaInsets` throws when no provider is mounted, which would make every screen
  // test that renders an action bar require a wrapper or a mock. Reading the context
  // directly returns null instead, and the floor padding below is a fine answer for a
  // phone — or a test — that reports no inset.
  const insets = useContext(SafeAreaInsetsContext);

  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets?.bottom ?? 0, tokens.spacing[3]) }]}
      accessibilityRole="toolbar"
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: tokens.layout.actionBarHeight,
    justifyContent: 'center',
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[3],
    // Opaque: content must pass behind the bar, never show through it.
    backgroundColor: tokens.colors.field.background,
    borderTopWidth: tokens.layout.ruleWidth,
    borderTopColor: tokens.colors.field.ruleSubtle,
  },
});
