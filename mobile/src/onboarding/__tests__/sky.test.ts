import { skyForStep } from '../sky';

describe('skyForStep', () => {
  it('places the sun at the start on step 0 and the end on the last step', () => {
    expect(skyForStep(0, 7).sunProgress).toBe(0);
    expect(skyForStep(6, 7).sunProgress).toBe(1);
  });
  it('returns three gradient stops that differ between dawn and dusk', () => {
    const dawn = skyForStep(0, 7);
    const dusk = skyForStep(6, 7);
    expect(dawn.stops).toHaveLength(3);
    expect(dawn.stops).not.toEqual(dusk.stops);
  });
  it('clamps out-of-range indices', () => {
    expect(skyForStep(-2, 7).sunProgress).toBe(0);
    expect(skyForStep(99, 7).sunProgress).toBe(1);
  });
});
