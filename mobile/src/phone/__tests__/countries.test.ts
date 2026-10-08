import { COUNTRIES, DEFAULT_COUNTRY, splitE164, toE164 } from '@/phone/countries';

describe('splitE164', () => {
  it('reconnaît le pays d’un numéro stocké', () => {
    expect(splitE164('+221771842787')).toEqual({
      country: expect.objectContaining({ iso: 'SN' }),
      local: '771842787',
    });
    expect(splitE164('+2290156343408')).toEqual({
      country: expect.objectContaining({ iso: 'BJ' }),
      local: '0156343408',
    });
  });

  it('préfère l’indicatif le plus long — 221 n’est pas 22', () => {
    // Sans ce tri, un sénégalais serait lu comme mauritanien (222) ou gambien (220).
    expect(splitE164('+221771842787').country.iso).toBe('SN');
    expect(splitE164('+22222000000').country.iso).toBe('MR');
    expect(splitE164('+2203000000').country.iso).toBe('GM');
  });

  it('rend un numéro d’indicatif inconnu modifiable, sans le réécrire', () => {
    // Un pays hors liste ne doit pas être avalé : les chiffres restent visibles.
    const { local } = splitE164('+99912345678');
    expect(local).toBe('99912345678');
  });

  it('part du Sénégal quand il n’y a rien', () => {
    expect(splitE164('').country).toBe(DEFAULT_COUNTRY);
    expect(splitE164(null)).toEqual({ country: DEFAULT_COUNTRY, local: '' });
  });
});

describe('toE164', () => {
  it('assemble la forme stockée', () => {
    expect(toE164(COUNTRIES[0]!, '77 184 27 87')).toBe('+221771842787');
  });

  it('retire le zéro d’acheminement que les gens tapent par habitude', () => {
    expect(toE164(COUNTRIES[0]!, '0771842787')).toBe('+221771842787');
  });

  /**
   * Le piège de ce module. Le zéro initial n'est PAS une règle globale : la France le retire
   * (06 81 01 37 59 = +33 681013759), le Bénin le garde (01 56 34 34 08 = +229 0156343408).
   * Le retirer partout supprimait un chiffre d'un abonné béninois réel — et la production en
   * contient quatre.
   */
  it('garde le zéro béninois et retire le zéro français', () => {
    const benin = COUNTRIES.find((c) => c.iso === 'BJ')!;
    const france = COUNTRIES.find((c) => c.iso === 'FR')!;
    expect(toE164(benin, '01 56 34 34 08')).toBe('+2290156343408');
    expect(toE164(france, '06 81 01 37 59')).toBe('+33681013759');
  });

  it('rend une chaîne vide quand il n’y a pas de numéro — pas un indicatif orphelin', () => {
    // Sinon un champ laissé vide stockerait '+221', que le backend prendrait pour un numéro.
    expect(toE164(COUNTRIES[0]!, '')).toBe('');
    expect(toE164(COUNTRIES[0]!, '   ')).toBe('');
  });

  it('fait l’aller-retour sans perte', () => {
    const { country, local } = splitE164('+2290156343408');
    expect(toE164(country, local)).toBe('+2290156343408');
  });
});
