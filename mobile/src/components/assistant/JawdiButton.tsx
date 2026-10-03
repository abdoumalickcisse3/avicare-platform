/**
 * The way into the assistant — a person, with a name.
 *
 * This replaces the microphone FAB. The microphone was honest about the *keyboard* (you may
 * speak) and silent about the *interlocutor*, so nothing on the home screen ever said who Jawdi
 * is. The button now carries the face, waves, and spells out "Jawdi IA / Votre conseiller": a
 * worker learns what is behind it without pressing it once. Dictation still exists — it lives
 * inside the assistant screen, where a microphone means what it says.
 *
 * Motion is decoration: when the phone asks for fewer animations the face is simply still, and
 * the name and role are plain text either way.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tokens } from '@/theme';
import { JawdiFace } from '@/components/assistant/JawdiFace';

const NAME = 'Jawdi IA';
const ROLE = 'Votre conseiller';

export function JawdiButton({ onPress, style }: { onPress: () => void; style?: object }) {
  const [animated, setAnimated] = useState(true);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((wantsLessMotion) => {
        if (!cancelled && wantsLessMotion) setAnimated(false);
      })
      // No answer from the OS is not a reason to freeze the face.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Parler à ${NAME}, votre conseiller d’élevage`}
      style={({ pressed }) => [styles.press, pressed && styles.pressed, style]}
    >
      <LinearGradient
        colors={[tokens.colors.primary[500], tokens.colors.primary[700]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.pill}
      >
        <JawdiFace size={46} animated={animated} />
        <View style={styles.words}>
          <Text style={styles.name}>{NAME}</Text>
          <Text style={styles.role}>{ROLE}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: {
    borderRadius: tokens.radii.full,
    shadowColor: '#1C1917',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.97 }] },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingLeft: tokens.spacing[2],
    paddingRight: tokens.spacing[4],
    paddingVertical: tokens.spacing[2],
    borderRadius: tokens.radii.full,
  },
  words: { justifyContent: 'center' },
  name: { ...tokens.typography.button, color: tokens.colors.neutral[0] },
  role: { ...tokens.typography.bodySm, color: tokens.colors.primary[100] },
});
