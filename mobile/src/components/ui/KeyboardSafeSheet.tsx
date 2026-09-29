/**
 * Building blocks for bottom-anchored form sheets shown in a React Native `Modal`.
 *
 * A `Modal` is not resized when the keyboard opens, so a sheet sitting at the bottom of it ends up
 * underneath the keyboard: the farmer types blind, and the fields below can't be reached. Every
 * form sheet therefore needs the same three things, provided here so none of them is forgotten:
 *
 *  - `KeyboardSafeSheet` — root inside the `Modal`; lifts the sheet above the keyboard.
 *  - `sheetBounds` — spread into the sheet's style; the sheet may shrink below its content height.
 *  - `SheetScroll` — the sheet's body; scrolls once the sheet has been squeezed.
 */
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export const sheetBounds = { flexShrink: 1, maxHeight: '92%' } as const;

export function KeyboardSafeSheet({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

export function SheetScroll({
  children,
  contentContainerStyle,
}: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={contentContainerStyle}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
});
