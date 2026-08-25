import { dailyRecordParser } from '../dailyRecordParser';
import type { ParseContext } from '../../types';

const ctx: ParseContext = { unitId: 7, activeUnits: [] };

describe('dailyRecordParser', () => {
  it('reads each quantity from its own unit marker, whatever the order', () => {
    const a = dailyRecordParser.parse('saisie du jour 3 morts 120 kg aliment 200 litres eau', ctx);
    const b = dailyRecordParser.parse('saisie du jour 200 litres eau 120 kg aliment 3 morts', ctx);

    expect(a).toMatchObject({ kind: 'DAILY_RECORD', mortalityCount: 3, feedKg: 120, waterL: 200 });
    // Spoken in another order, the same figures land on the same fields.
    expect(b).toMatchObject({ mortalityCount: 3, feedKg: 120, waterL: 200 });
  });

  it('accepts spelled-out numbers', () => {
    expect(
      dailyRecordParser.parse('saisie journalière douze morts quatre-vingts kg aliment', ctx),
    ).toMatchObject({ mortalityCount: 12, feedKg: 80 });
  });

  it('leaves an unspoken figure undefined instead of borrowing its neighbour', () => {
    const out = dailyRecordParser.parse('saisie du jour 120 kg aliment', ctx);

    expect(out).toMatchObject({ feedKg: 120, waterL: undefined });
    // An unspoken mortality means none, which is what a farmer means here.
    expect(out?.mortalityCount).toBe(0);
  });

  it('ignores a bare mortality phrase — that is a mortality, not a day', () => {
    expect(dailyRecordParser.parse('3 morts', ctx)).toBeNull();
    expect(dailyRecordParser.parse("j'ai perdu dix poules", ctx)).toBeNull();
  });

  it('declines a daily entry carrying no figure at all', () => {
    // Nothing to put on a confirmation card: let the LLM ask what happened.
    expect(dailyRecordParser.parse('saisie du jour', ctx)).toBeNull();
  });

  it('resolves the lot from the context', () => {
    expect(dailyRecordParser.parse('saisie du jour 2 morts', ctx)?.unitId).toBe(7);
    expect(
      dailyRecordParser.parse('saisie du jour 2 morts', { activeUnits: [] })?.unitId,
    ).toBeNull();
  });
});
