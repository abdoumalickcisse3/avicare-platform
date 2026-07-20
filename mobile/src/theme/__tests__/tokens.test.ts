import { tokens } from '../tokens';

describe('design tokens', () => {
  it('keeps the locked brand colours from doc 10', () => {
    expect(tokens.colors.primary[500]).toBe('#3D8B3D');
    expect(tokens.colors.primary[600]).toBe('#2E6B2E');
    expect(tokens.colors.accent[400]).toBe('#F8961E');
  });

  it('meets the doc 10 touch-target floor', () => {
    expect(tokens.touch.min).toBeGreaterThanOrEqual(44);
    expect(tokens.touch.button).toBeGreaterThanOrEqual(48);
  });

  it('uses a 4px spacing scale', () => {
    for (const value of Object.values(tokens.spacing)) {
      expect(value % 4).toBe(0);
    }
  });
});
