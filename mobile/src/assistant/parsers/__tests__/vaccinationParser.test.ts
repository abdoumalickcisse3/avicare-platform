import { vaccinationParser } from '../vaccinationParser';
import type { ParseContext } from '../../types';

const VACCINES = [
  { key: 'newcastle_lasota', label: 'Newcastle La Sota', disease: 'Newcastle' },
  { key: 'gumboro', label: 'Gumboro', disease: 'Maladie de Gumboro' },
];
const ctx: ParseContext = { unitId: 7, activeUnits: [], vaccines: VACCINES };

describe('vaccinationParser', () => {
  it('resolves the vaccine against the farm catalog', () => {
    expect(vaccinationParser.parse('vaccination gumboro 480 sujets', ctx)).toMatchObject({
      kind: 'VACCINATION',
      vaccineKey: 'gumboro',
      vaccineLabel: 'Gumboro',
      subjectsCount: 480,
      unitId: 7,
    });
  });

  it('prefers the longest matching name', () => {
    // Both "Newcastle" (disease) and "Newcastle La Sota" (label) appear in the phrase.
    expect(
      vaccinationParser.parse("j'ai vacciné 500 poulets newcastle la sota", ctx)?.vaccineKey,
    ).toBe('newcastle_lasota');
  });

  it('matches a disease name too', () => {
    expect(
      vaccinationParser.parse('vaccination contre la maladie de gumboro, 300 sujets', ctx)
        ?.vaccineKey,
    ).toBe('gumboro');
  });

  it('declines a vaccine the farm does not carry', () => {
    // Inventing a key produces a draft the backend rejects — let the LLM resolve it.
    expect(vaccinationParser.parse('vaccination bronchite 400 sujets', ctx)).toBeNull();
  });

  it('declines when no catalog is cached', () => {
    expect(
      vaccinationParser.parse('vaccination gumboro 480 sujets', { unitId: 7, vaccines: [] }),
    ).toBeNull();
  });

  it('declines without a subject count', () => {
    expect(vaccinationParser.parse('vaccination gumboro faite', ctx)).toBeNull();
  });

  it('ignores a phrase that is not a vaccination', () => {
    expect(vaccinationParser.parse('300 poulets sont morts', ctx)).toBeNull();
  });
});
