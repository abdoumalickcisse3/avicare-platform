/**
 * Soft surface card — the mobile counterpart of the web's MUI Card, so both
 * apps read as one product: white surface, rounded corners, a hairline border
 * and a very soft shadow. Used on consultation screens (dashboard, lot detail).
 *
 * NOT for the field entry screens, which stay on the high-contrast "field mode"
 * white sheet (design direction §4) — cards are for reading, not for gloved
 * data entry under direct sun.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { tokens } from '@/theme';

export function Card({ children, style, padded = true }: { children: ReactNode; style?: ViewStyle; padded?: boolean }) {
  return <View style={[styles.card, padded && styles.padded, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.radii.xl,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    // Soft elevation — Android + iOS.
    shadowColor: '#1C1917',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  padded: {
    padding: tokens.spacing[4],
  },
});
