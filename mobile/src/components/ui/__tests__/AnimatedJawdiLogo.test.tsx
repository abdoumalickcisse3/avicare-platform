import { AccessibilityInfo } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { AnimatedJawdiLogo } from '../AnimatedJawdiLogo';
import { logoIconPaths, logoPaths, logoSunPaths, logoWordmarkPaths } from '@/brand/logoPaths';

describe('AnimatedJawdiLogo', () => {
  it('découpe le logo en trois couches, sans en perdre ni en dupliquer un tracé', () => {
    // Les couches sont animées séparément : si le découpage dérive, le logo se
    // reconstituerait amputé à l'écran sans qu'aucun rendu n'échoue.
    const union = [...logoSunPaths, ...logoIconPaths, ...logoWordmarkPaths];
    expect(union).toHaveLength(logoPaths.length);
    expect(new Set(union.map((p) => p.d)).size).toBe(logoPaths.length);
    expect(logoSunPaths).toHaveLength(1);
  });

  it('monte les trois couches', async () => {
    await render(<AnimatedJawdiLogo height={76} />);

    expect(screen.getByTestId('jawdi-logo-sun')).toBeTruthy();
    expect(screen.getByTestId('jawdi-logo-land')).toBeTruthy();
    expect(screen.getByTestId('jawdi-logo-word')).toBeTruthy();
  });

  it('se pose sans bouger quand le téléphone demande des animations réduites', async () => {
    const reduced = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    await render(<AnimatedJawdiLogo height={76} />);

    expect(reduced).toHaveBeenCalled();
    expect(screen.getByTestId('jawdi-logo-sun')).toBeTruthy();
    reduced.mockRestore();
  });
});
