import { Platform, Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { KeyboardSafeSheet, SheetScroll, sheetBounds } from '../KeyboardSafeSheet';

function rootStyle() {
  const root = screen.toJSON() as unknown as { props: { style: unknown } };
  return ([] as object[]).concat(root.props.style as object[]).reduce((a, s) => ({ ...a, ...s }), {});
}

describe('KeyboardSafeSheet', () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
  });

  it('lifts a bottom-anchored sheet above the keyboard on iOS (a Modal is not resized by it)', async () => {
    Platform.OS = 'ios';
    await render(
      <KeyboardSafeSheet>
        <Text>contenu</Text>
      </KeyboardSafeSheet>,
    );
    expect(rootStyle()).toEqual(expect.objectContaining({ paddingBottom: expect.any(Number) }));
  });

  it('anchors its children to the bottom so the sheet sits on the keyboard', async () => {
    await render(
      <KeyboardSafeSheet>
        <Text>contenu</Text>
      </KeyboardSafeSheet>,
    );
    expect(rootStyle()).toEqual(expect.objectContaining({ flex: 1, justifyContent: 'flex-end' }));
  });

  it('does not change Android behaviour (its window already resizes)', async () => {
    Platform.OS = 'android';
    await render(
      <KeyboardSafeSheet>
        <Text>contenu</Text>
      </KeyboardSafeSheet>,
    );
    expect(rootStyle()).not.toHaveProperty('paddingBottom');
  });
});

describe('SheetScroll', () => {
  it('keeps taps working with the keyboard open and dismisses it on drag so the fields below can be reached', async () => {
    await render(
      <SheetScroll>
        <Text>champ</Text>
      </SheetScroll>,
    );
    const scroll = screen.toJSON() as unknown as { type: string; props: Record<string, unknown> };
    expect(scroll.type).toBe('RCTScrollView');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(scroll.props.keyboardDismissMode).toBe('on-drag');
    expect(scroll.props.showsVerticalScrollIndicator).toBe(false);
  });
});

describe('sheetBounds', () => {
  it('lets a sheet shrink below its content height so its body scrolls instead of running off screen', () => {
    expect(sheetBounds.flexShrink).toBe(1);
    expect(sheetBounds.maxHeight).toBe('92%');
  });
});
