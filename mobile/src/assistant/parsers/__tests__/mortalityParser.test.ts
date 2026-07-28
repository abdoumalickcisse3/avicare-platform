import { mortalityParser } from '../mortalityParser';
import type { ParseContext } from '../../types';

const CTX: ParseContext = { unitId: 3 };
const parse = (t: string, ctx: ParseContext = CTX) => mortalityParser.parse(t, ctx);

describe('mortalityParser', () => {
  it('parses a digit count', () => {
    expect(parse('5 morts ce matin')).toEqual({ kind: 'MORTALITY', count: 5, reason: undefined, unitId: 3 });
  });

  it('parses a spelled-out count ("dix sont morts")', () => {
    expect(parse('dix sont morts')?.count).toBe(10);
  });

  it('parses a compound number ("vingt-trois")', () => {
    expect(parse('vingt-trois poules sont mortes')?.count).toBe(23);
  });

  it('parses 70/80/90 forms', () => {
    expect(parse('soixante-douze morts')?.count).toBe(72);
    expect(parse('quatre-vingt-dix-neuf morts')?.count).toBe(99);
  });

  it('recognizes several mortality verbs', () => {
    expect(parse("j'ai perdu 3 poussins")?.count).toBe(3);
    expect(parse('deux décès aujourd’hui')?.count).toBe(2);
  });

  it('extracts an optional reason', () => {
    const r = parse('3 morts à cause de la chaleur');
    expect(r?.count).toBe(3);
    expect(r?.reason).toMatch(/chaleur/);
  });

  it('returns null when there is no mortality intent', () => {
    expect(parse("j'ai vendu 30 poulets à Modou")).toBeNull();
  });

  it('returns null when a mortality verb has no count', () => {
    expect(parse('des poules sont mortes')).toBeNull();
  });

  it('resolves the unit from context', () => {
    expect(parse('4 morts', { unitId: 42 })?.unitId).toBe(42);
  });

  it('defaults to the single active unit when no unitId given', () => {
    const ctx: ParseContext = { activeUnits: [{ id: 7, name: 'B-1', currentCount: 100 }] };
    expect(parse('4 morts', ctx)?.unitId).toBe(7);
  });

  it('leaves unitId null when the lot is ambiguous', () => {
    const ctx: ParseContext = {
      activeUnits: [
        { id: 7, name: 'B-1', currentCount: 100 },
        { id: 8, name: 'B-2', currentCount: 80 },
      ],
    };
    expect(parse('4 morts', ctx)?.unitId).toBeNull();
  });
});
