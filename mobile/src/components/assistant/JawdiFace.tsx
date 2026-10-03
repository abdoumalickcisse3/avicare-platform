/**
 * Jawdi's face — the assistant drawn as a person, not as an icon.
 *
 * The entry point to the assistant used to be a microphone. A microphone names the *input*
 * ("record something") when what we want to name is the *interlocutor* ("someone is there who
 * knows your farm"). So Jawdi gets a face: a head, eyes that blink, a smile, and a hand that
 * waves every few seconds — enough life that a worker who has never spoken to a machine reads
 * the button as a person to talk to.
 *
 * Pure `react-native-svg`: no image asset, no animation library, no bundle weight, and it scales
 * from the 44dp avatar of a button to whatever a screen wants. Motion is the only thing that is
 * optional: `animated={false}` draws the same face, awake and still, for a phone that asked for
 * less movement.
 *
 * `wave={false}` drops the hand. A wave is a greeting: it belongs on the button and on the
 * opening of a conversation, not beside every single reply — ten messages would be ten hands
 * waving at once.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';

/** How the person is coloured. Warm brown skin, dark cropped hair, Jawdi-orange shirt. */
const SKIN = '#A86B3C';
const SKIN_SHADE = '#8A552E';
const HAIR = '#1F1812';
const SHIRT = '#E67E0A';
const INK = '#2B1C0E';
const EYE_WHITE = '#FFFFFF';

/** One blink every ~3.2 s, shut for 130 ms — the cadence of a face at rest. */
const BLINK_EVERY = 3200;
const BLINK_FOR = 130;
/** The hand waves on arrival, then every 6 s: present, never agitated. */
const WAVE_FIRST = 400;
const WAVE_EVERY = 6000;
const WAVE_SWING = 180;

export function JawdiFace({
  size = 48,
  animated = true,
  wave = true,
}: {
  size?: number;
  animated?: boolean;
  wave?: boolean;
}) {
  return (
    <View style={{ width: wave ? size + size * 0.46 : size, height: size }}>
      <Head size={size} animated={animated} />
      {wave ? (
        <WavingHand size={size * 0.52} animated={animated} left={size * 0.9} top={size * 0.02} />
      ) : null}
    </View>
  );
}

/** Head, shoulders and eyes, clipped to a round avatar. */
function Head({ size, animated }: { size: number; animated: boolean }) {
  const [shut, setShut] = useState(false);

  useEffect(() => {
    if (!animated) return;
    let open: ReturnType<typeof setTimeout> | undefined;
    const blink = setInterval(() => {
      setShut(true);
      open = setTimeout(() => setShut(false), BLINK_FOR);
    }, BLINK_EVERY);
    return () => {
      clearInterval(blink);
      if (open) clearTimeout(open);
    };
  }, [animated]);

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <ClipPath id="jawdi-head">
          <Circle cx="50" cy="50" r="50" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#jawdi-head)">
        {/* The cream disc the person stands on — the face must not sit on the green pill. */}
        <Circle cx="50" cy="50" r="50" fill="#F7EFE2" />
        {/* Shoulders, then neck, then head: back to front. */}
        <Ellipse cx="50" cy="106" rx="37" ry="28" fill={SHIRT} />
        <Rect x="42" y="64" width="16" height="18" fill={SKIN_SHADE} />
        <Circle cx="25" cy="50" r="5" fill={SKIN_SHADE} />
        <Circle cx="75" cy="50" r="5" fill={SKIN_SHADE} />
        <Circle cx="50" cy="46" r="24" fill={SKIN} />
        {/* Short cropped hair: a cap over the top third of the head. */}
        <Path d="M 27 41 A 23 23 0 0 1 73 41 Z" fill={HAIR} />
        <Path d="M 34 40 Q 40 37 46 40" stroke={HAIR} strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <Path d="M 54 40 Q 60 37 66 40" stroke={HAIR} strokeWidth="2.4" strokeLinecap="round" fill="none" />
        {shut ? (
          <G testID="jawdi-eyes-closed">
            <Path d="M 35 48 Q 40 51 45 48" stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" />
            <Path d="M 55 48 Q 60 51 65 48" stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          </G>
        ) : (
          <G testID="jawdi-eyes-open">
            <Ellipse cx="40" cy="48" rx="5.4" ry="4" fill={EYE_WHITE} />
            <Ellipse cx="60" cy="48" rx="5.4" ry="4" fill={EYE_WHITE} />
            <Circle cx="40.6" cy="48" r="2.5" fill={INK} />
            <Circle cx="60.6" cy="48" r="2.5" fill={INK} />
          </G>
        )}
        <Path d="M 50 50 q 1 5 3.5 6" stroke={SKIN_SHADE} strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* The smile — the single most important stroke on the button. */}
        <Path d="M 41 60 Q 50 68 59 60" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
      </G>
    </Svg>
  );
}

/** An open hand raised beside the head, pivoting at the wrist. */
function WavingHand({
  size,
  animated,
  left,
  top,
}: {
  size: number;
  animated: boolean;
  left: number;
  top: number;
}) {
  const swing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    const wave = () =>
      Animated.sequence([
        Animated.timing(swing, { toValue: 1, duration: WAVE_SWING, useNativeDriver: true }),
        Animated.timing(swing, { toValue: -1, duration: WAVE_SWING * 2, useNativeDriver: true }),
        Animated.timing(swing, { toValue: 1, duration: WAVE_SWING * 2, useNativeDriver: true }),
        Animated.timing(swing, {
          toValue: 0,
          duration: WAVE_SWING,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();

    const hello = setTimeout(wave, WAVE_FIRST);
    const again = setInterval(wave, WAVE_EVERY);
    return () => {
      clearTimeout(hello);
      clearInterval(again);
      swing.stopAnimation();
    };
  }, [animated, swing]);

  return (
    <Animated.View
      style={[
        styles.hand,
        { left, top, width: size, height: size },
        {
          transform: [
            {
              rotate: swing.interpolate({
                inputRange: [-1, 1],
                outputRange: ['-20deg', '20deg'],
              }),
            },
          ],
        },
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 40 44">
        {/* Four fingers, then the thumb, then the palm over their roots. */}
        {[11, 16, 21, 26].map((x, i) => (
          <Rect
            key={x}
            x={x}
            y={6 + (i === 0 || i === 3 ? 3 : 0)}
            width="4.4"
            height={i === 0 || i === 3 ? 14 : 16}
            rx="2.2"
            fill={SKIN}
          />
        ))}
        <Rect x="5" y="20" width="5" height="12" rx="2.5" fill={SKIN} transform="rotate(-24 7.5 26)" />
        <Rect x="9" y="18" width="22" height="20" rx="9" fill={SKIN} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hand: { position: 'absolute', transformOrigin: '50% 100%' },
});
