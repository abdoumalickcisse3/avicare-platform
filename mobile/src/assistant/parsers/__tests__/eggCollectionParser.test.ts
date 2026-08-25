import { eggCollectionParser } from '../eggCollectionParser';
import type { ParseContext } from '../../types';

const ctx: ParseContext = { unitId: 7, activeUnits: [] };

describe('eggCollectionParser', () => {
  it('reads the count and the timeslot', () => {
    expect(eggCollectionParser.parse('ramassage du matin 320 oeufs', ctx)).toMatchObject({
      kind: 'EGG_COLLECTION',
      totalEggs: 320,
      timeslotKey: 'morning',
      unitId: 7,
    });
  });

  it('maps each spoken moment to its catalog key', () => {
    expect(eggCollectionParser.parse('collecte midi 150 oeufs', ctx)?.timeslotKey).toBe('noon');
    expect(eggCollectionParser.parse('ramassage du soir 210 oeufs', ctx)?.timeslotKey).toBe(
      'evening',
    );
  });

  it('refuses an ambiguous moment rather than picking a slot', () => {
    // Slots are 06:00 / 12:00 / 18:00 — an afternoon sits between the last two, and filing it
    // under the wrong one overwrites a real collection. The LLM can ask.
    expect(eggCollectionParser.parse("collecte de l'après-midi 90 oeufs", ctx)).toBeNull();
  });

  it('picks up the broken eggs', () => {
    expect(
      eggCollectionParser.parse('ramassage du matin 320 oeufs dont 4 cassés', ctx),
    ).toMatchObject({ totalEggs: 320, brokenEggs: 4 });
  });

  it('refuses to guess a missing timeslot', () => {
    // The backend upserts on unit + date + timeslot: the wrong slot overwrites another
    // collection, so this goes to the LLM to ask rather than to a confirmation card.
    expect(eggCollectionParser.parse('ramassage 320 oeufs', ctx)).toBeNull();
  });

  it('drops a broken count that swallowed the total', () => {
    const out = eggCollectionParser.parse('ramassage du matin cassés 320 oeufs', ctx);

    expect(out?.totalEggs).toBe(320);
    expect(out?.brokenEggs).toBeUndefined();
  });

  it('accepts spelled-out counts', () => {
    expect(eggCollectionParser.parse('ramassage du soir quatre-vingts oeufs', ctx)).toMatchObject({
      totalEggs: 80,
      timeslotKey: 'evening',
    });
  });

  it('ignores a phrase that is not a collection', () => {
    expect(eggCollectionParser.parse('3 morts ce matin', ctx)).toBeNull();
  });
});
