import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ActionBar } from '../ActionBar';
import { tokens } from '@/theme';

import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

const NO_INSET = { top: 0, bottom: 0, left: 0, right: 0 };

/** Wraps the bar in a real inset context — the bar reads the context, it does not throw. */
function withInsets(bottom: number, children: React.ReactNode) {
  return (
    <SafeAreaInsetsContext.Provider value={{ ...NO_INSET, bottom }}>
      {children}
    </SafeAreaInsetsContext.Provider>
  );
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flattenStyle));
  return (style as Record<string, unknown>) ?? {};
}

/**
 * The bar is the root of its own render, so its style is readable from the tree without
 * adding a `testID` — a convention this repo does not use anywhere else. RNTL cannot query
 * `accessibilityRole="toolbar"`, which stays on the element for screen readers regardless.
 */
function barStyle(tree: ReturnType<typeof render> extends Promise<infer R> ? R : never) {
  const root = tree.toJSON();
  const node = Array.isArray(root) ? root[0] : root;
  return flattenStyle(node?.props?.style);
}

describe('ActionBar', () => {
  it('renders its action', async () => {
    const { getByText } = await render(
      <ActionBar>
        <Text>Enregistrer</Text>
      </ActionBar>,
    );

    expect(getByText('Enregistrer')).toBeTruthy();
  });

  it('clears the gesture bar so the button is not half-owned by the system', async () => {
    const tree = await render(
      withInsets(
        34,
        <ActionBar>
          <Text>Enregistrer</Text>
        </ActionBar>,
      ),
    );

    // A button flush against a gesture bar is one people miss, then press twice.
    expect(barStyle(tree).paddingBottom).toBe(34);
  });

  it('keeps a floor of padding on a phone with no inset', async () => {
    const tree = await render(
      <ActionBar>
        <Text>Enregistrer</Text>
      </ActionBar>,
    );

    expect(barStyle(tree).paddingBottom).toBe(tokens.spacing[3]);
  });

  it('renders without a safe-area provider rather than throwing', async () => {
    // Otherwise every screen test that reaches an action bar would need a wrapper or a mock,
    // and the primitive would be a tax on the fifteen screens about to use it.
    const tree = await render(
      <ActionBar>
        <Text>Enregistrer</Text>
      </ActionBar>,
    );

    expect(barStyle(tree).paddingBottom).toBe(tokens.spacing[3]);
  });

  it('is tall enough to hold the field call to action', async () => {
    const tree = await render(
      <ActionBar>
        <Text>Enregistrer</Text>
      </ActionBar>,
    );

    // The token exists precisely so this height is not re-decided per screen.
    expect(barStyle(tree).minHeight).toBe(tokens.layout.actionBarHeight);
  });

  it('is opaque, so scrolling content passes behind it', async () => {
    const tree = await render(
      <ActionBar>
        <Text>Enregistrer</Text>
      </ActionBar>,
    );

    // A value half-visible under a translucent bar is a value someone will misread.
    expect(barStyle(tree).backgroundColor).toBe(tokens.colors.field.background);
  });
});
