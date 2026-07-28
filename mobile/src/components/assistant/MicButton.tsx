/**
 * Mic button — the field worker's entry point to the assistant. A prominent,
 * glove-friendly round button that opens the AssistantSheet.
 */
import { Pressable, StyleSheet } from 'react-native';
import { Mic } from 'lucide-react-native';
import { tokens } from '@/theme';

export function MicButton({ onPress, style }: { onPress: () => void; style?: object }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }, style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Parler à Jawdi"
    >
      <Mic size={28} color={tokens.colors.neutral[0]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 60,
    height: 60,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1C1917',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
