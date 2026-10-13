/**
 * Le logo Jawdi qui s'assemble — réservé à l'écran de démarrage.
 *
 * Trois couches superposées, chacune un `<Svg>` au même `viewBox` : elles se
 * recalent donc toutes seules, et on anime des `View` ordinaires plutôt que des
 * attributs SVG, ce qui évite de dépendre du support d'animation de
 * `react-native-svg`.
 *
 * L'ordre de rendu n'est pas décoratif : le soleil est dessiné EN DESSOUS des
 * collines, comme dans le fichier d'origine. Il monte donc depuis l'arrière du
 * paysage — un vrai lever de soleil, pas un disque qui apparaît par-dessus.
 *
 * Le mouvement se coupe si le téléphone demande des animations réduites : le
 * logo se pose alors d'emblée dans son état final.
 */

import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import {
  logoAspectRatio,
  logoIconPaths,
  logoSunPaths,
  logoViewBox,
  logoWordmarkPaths,
} from '../../brand/logoPaths';

type Props = {
  /** Hauteur en dp ; la largeur suit le ratio natif du logo. */
  height: number;
  /** `white` sur fond sombre ou photographique, `color` sur fond clair. */
  tone?: 'color' | 'white';
};

type Layer = readonly { fill: string; d: string }[];

function Plate({ paths, tone, height }: { paths: Layer; tone: Props['tone']; height: number }) {
  return (
    <Svg
      width={height * logoAspectRatio}
      height={height}
      viewBox={logoViewBox}
      style={StyleSheet.absoluteFill}
    >
      {paths.map((p, i) => (
        <Path key={i} d={p.d} fill={tone === 'white' ? '#FFFFFF' : p.fill} />
      ))}
    </Svg>
  );
}

export function AnimatedJawdiLogo({ height, tone = 'white' }: Props) {
  const land = useSharedValue(0);
  const sun = useSharedValue(0);
  const word = useSharedValue(0);

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduced) => {
        if (cancelled) return;
        if (reduced) {
          land.value = 1;
          sun.value = 1;
          word.value = 1;
          return;
        }
        // Le paysage se pose, le soleil se lève dessus, le nom arrive.
        land.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
        sun.value = withDelay(260, withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }));
        word.value = withDelay(460, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
      });

    return () => {
      cancelled = true;
    };
  }, [land, sun, word]);

  // Les décalages sont exprimés en fraction de la hauteur : le logo s'anime de
  // la même façon qu'on l'affiche à 56 ou à 120 dp.
  const landStyle = useAnimatedStyle(() => ({
    opacity: land.value,
    transform: [{ translateY: (1 - land.value) * height * 0.09 }],
  }));
  const sunStyle = useAnimatedStyle(() => ({
    opacity: sun.value,
    transform: [{ translateY: (1 - sun.value) * height * 0.2 }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateX: (1 - word.value) * height * -0.12 }],
  }));

  return (
    <View
      style={{ width: height * logoAspectRatio, height }}
      accessibilityRole="image"
      accessibilityLabel="Jawdi"
    >
      <Animated.View testID="jawdi-logo-sun" style={[StyleSheet.absoluteFill, sunStyle]}>
        <Plate paths={logoSunPaths} tone={tone} height={height} />
      </Animated.View>
      <Animated.View testID="jawdi-logo-land" style={[StyleSheet.absoluteFill, landStyle]}>
        <Plate paths={logoIconPaths} tone={tone} height={height} />
      </Animated.View>
      <Animated.View testID="jawdi-logo-word" style={[StyleSheet.absoluteFill, wordStyle]}>
        <Plate paths={logoWordmarkPaths} tone={tone} height={height} />
      </Animated.View>
    </View>
  );
}
