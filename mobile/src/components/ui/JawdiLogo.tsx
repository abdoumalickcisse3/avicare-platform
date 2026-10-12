/**
 * Logo Jawdi, rendu en vectoriel.
 *
 * On passe par `react-native-svg` plutôt que par un PNG : le logo reste net sur
 * toutes les densités d'écran, y compris les téléphones 3x, sans embarquer trois
 * tailles d'image. Les tracés viennent de `src/brand/logoPaths.ts`, généré
 * depuis le fichier Illustrator du designer.
 *
 * C'est le lockup *compact* (sans la baseline) : aux hauteurs où l'app affiche
 * le logo — 56 dp à la connexion, 76 dp au démarrage — la baseline ferait moins
 * de 3 dp de haut, soit une bavure illisible.
 */

import Svg, { Path } from 'react-native-svg';

import { logoAspectRatio, logoPaths, logoViewBox } from '../../brand/logoPaths';

type Props = {
  /** Hauteur en dp ; la largeur suit le ratio natif du logo. */
  height: number;
  /**
   * `color` sur fond clair, `white` sur fond sombre ou photographique.
   * Le blanc aplatit le logo d'un seul tenant : les contre-formes (la vache, la
   * poule) restent des découpes, c'est le fond qui les redessine.
   */
  tone?: 'color' | 'white';
  /** Lu par les lecteurs d'écran ; `null` pour une image purement décorative. */
  label?: string | null;
};

export function JawdiLogo({ height, tone = 'color', label = 'Jawdi' }: Props) {
  return (
    <Svg
      height={height}
      width={height * logoAspectRatio}
      viewBox={logoViewBox}
      accessibilityRole="image"
      accessibilityLabel={label ?? undefined}
      accessibilityElementsHidden={label === null}
      importantForAccessibility={label === null ? 'no-hide-descendants' : 'yes'}
    >
      {logoPaths.map((p, i) => (
        <Path key={i} d={p.d} fill={tone === 'white' ? '#FFFFFF' : p.fill} />
      ))}
    </Svg>
  );
}
