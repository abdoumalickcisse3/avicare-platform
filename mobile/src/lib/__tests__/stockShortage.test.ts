import { missingQuantity, stockShortage } from '../stockShortage';

const properties = {
  stockItemId: 7,
  articleKey: 'feed.starter',
  articleLabel: 'Aliment démarrage',
  unit: 'sac',
  available: -2,
  requested: 3,
};

describe('stockShortage', () => {
  it('lit un refus arrivé en direct depuis RTK Query', () => {
    const found = stockShortage({ status: 422, data: { code: 'STOCK_INSUFFICIENT', properties } });
    expect(found).toEqual({
      stockItemId: 7,
      articleLabel: 'Aliment démarrage',
      unit: 'sac',
      available: -2,
      requested: 3,
    });
  });

  it('lit le même refus relu depuis la file hors ligne', () => {
    // Le chemin qui compte vraiment : la saisie de terrain est partie en file, le refus est
    // revenu des heures plus tard et a été rangé dans SQLite sans son enveloppe HTTP.
    expect(stockShortage({ code: 'STOCK_INSUFFICIENT', properties })).not.toBeNull();
  });

  it('ignore une erreur qui n’est pas un manque de stock', () => {
    expect(stockShortage({ status: 403, data: { code: 'FORBIDDEN' } })).toBeNull();
  });

  it('ignore un refus sans propriétés — un backend antérieur à ADR-018', () => {
    // Ouvrir une fenêtre de réparation vide serait pire que de laisser le message passer.
    expect(stockShortage({ data: { code: 'STOCK_INSUFFICIENT' } })).toBeNull();
  });

  it('ignore un refus dont les quantités ne sont pas des nombres', () => {
    expect(
      stockShortage({ data: { code: 'STOCK_INSUFFICIENT', properties: { ...properties, available: '-2' } } }),
    ).toBeNull();
  });

  it('nomme l’article par défaut quand le libellé manque', () => {
    const { articleLabel, ...rest } = properties;
    expect(stockShortage({ data: { code: 'STOCK_INSUFFICIENT', properties: rest } })?.articleLabel).toBe(
      'cet article',
    );
  });

  it('ne casse pas sur null, une chaîne ou un objet vide', () => {
    expect(stockShortage(null)).toBeNull();
    expect(stockShortage('boom')).toBeNull();
    expect(stockShortage({})).toBeNull();
  });
});

describe('missingQuantity', () => {
  it('comble le trou, pas seulement la demande', () => {
    // Sur une ligne à −2 qui doit en sortir 3, entrer 3 laisserait le solde à −2.
    expect(missingQuantity({ available: -2, requested: 3 })).toBe(5);
  });

  it('vaut la demande quand le stock est à zéro', () => {
    expect(missingQuantity({ available: 0, requested: 4 })).toBe(4);
  });
});
