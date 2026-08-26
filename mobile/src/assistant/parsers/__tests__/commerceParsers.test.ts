import { createClientParser } from '../createClientParser';
import { stockAdjustParser } from '../stockAdjustParser';
import { rulesParse } from '..';
import type { ParseContext } from '../../types';

const STOCK = [
  { id: 4, articleKey: 'mais', unit: 'sac' },
  { id: 9, articleKey: 'premix', unit: 'kg' },
  { id: 12, articleKey: 'tourteau_soja', unit: 'sac' },
];
const ctx: ParseContext = { unitId: 7, activeUnits: [], stockItems: STOCK };

describe('createClientParser', () => {
  it('keeps the name and defaults to an individual', () => {
    expect(createClientParser.parse('nouveau client Modou Diop', ctx)).toEqual({
      kind: 'CREATE_CLIENT',
      displayName: 'Modou Diop',
      clientType: 'INDIVIDUAL',
    });
  });

  it('reads the client type from the word used', () => {
    expect(createClientParser.parse('nouveau grossiste Sénégal Volaille', ctx)).toMatchObject({
      displayName: 'Sénégal Volaille',
      clientType: 'WHOLESALER',
    });
    expect(createClientParser.parse('ajoute un client restaurant Le Baobab', ctx)).toMatchObject({
      clientType: 'BUSINESS',
    });
  });

  it('declines a command with no name', () => {
    expect(createClientParser.parse('nouveau client', ctx)).toBeNull();
    // Digits alone are a misread, not a name.
    expect(createClientParser.parse('nouveau client 42', ctx)).toBeNull();
  });

  it('ignores a phrase that is not a creation', () => {
    expect(createClientParser.parse('le client Modou a payé', ctx)).toBeNull();
  });
});

describe('stockAdjustParser', () => {
  it('reads a reception as a positive delta', () => {
    expect(stockAdjustParser.parse('réception 20 sacs de maïs', ctx)).toMatchObject({
      kind: 'ADJUST_STOCK',
      stockItemId: 4,
      articleKey: 'mais',
      delta: 20,
      unit: 'sac',
    });
  });

  it('reads a loss as a negative delta', () => {
    expect(stockAdjustParser.parse('perte de 5 kg de prémix', ctx)).toMatchObject({
      stockItemId: 9,
      delta: -5,
    });
  });

  it('refuses a phrase with no explicit direction', () => {
    // "20 sacs de maïs" says nothing about in or out; guessing moves the stock the wrong way.
    expect(stockAdjustParser.parse('20 sacs de maïs', ctx)).toBeNull();
  });

  it('refuses a phrase carrying both directions', () => {
    expect(stockAdjustParser.parse('réception et perte de 5 kg de prémix', ctx)).toBeNull();
  });

  it('declines an article the farm does not stock', () => {
    // An invented stockItemId fails on the server, after the farmer confirmed.
    expect(stockAdjustParser.parse('réception 20 sacs de blé', ctx)).toBeNull();
  });

  it('declines when no stock catalog is cached', () => {
    expect(
      stockAdjustParser.parse('réception 20 sacs de maïs', { unitId: 7, stockItems: [] }),
    ).toBeNull();
  });

  it('declines without a quantity', () => {
    expect(stockAdjustParser.parse('réception de maïs', ctx)).toBeNull();
  });
});

describe('rulesParse (commerce)', () => {
  it('routes each phrase to its parser', () => {
    expect(rulesParse('nouveau client Modou Diop', ctx)?.kind).toBe('CREATE_CLIENT');
    expect(rulesParse('réception 20 sacs de maïs', ctx)?.kind).toBe('ADJUST_STOCK');
  });

  it('still leaves the online-only actions to the LLM', () => {
    // A sale, a payment and a purchase hit live mutations with server preconditions; they are
    // not confirmable offline, so a rules parser would buy nothing.
    expect(rulesParse("j'ai vendu 30 poulets à 2500", ctx)).toBeNull();
    expect(rulesParse('Modou a payé 50000', ctx)).toBeNull();
    expect(rulesParse('commande 10 sacs chez le fournisseur', ctx)).toBeNull();
  });
});
