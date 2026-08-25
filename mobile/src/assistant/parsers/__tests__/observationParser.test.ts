import { observationParser } from '../observationParser';
import { rulesParse } from '..';
import type { ParseContext } from '../../types';

const ctx: ParseContext = { unitId: 7, activeUnits: [] };

describe('observationParser', () => {
  it('keeps what follows the observation verb as the title', () => {
    expect(observationParser.parse('je constate des boiteries dans le lot', ctx)).toMatchObject({
      kind: 'HEALTH_OBSERVATION',
      title: 'des boiteries dans le lot',
      unitId: 7,
    });
  });

  it('reads an explicit severity', () => {
    expect(observationParser.parse('observation : toux, c est grave', ctx)?.severity).toBe(
      'CRITICAL',
    );
    expect(observationParser.parse('observation : plumage bizarre', ctx)?.severity).toBe('WARNING');
    expect(observationParser.parse('observation : plumage terne', ctx)?.severity).toBeUndefined();
  });

  it('never swallows a phrase another parser owns', () => {
    // "je constate 3 morts" is a mortality; letting the loosest parser claim it would lose the
    // count and file a free-text note instead.
    expect(observationParser.parse('je constate 3 morts', ctx)).toBeNull();
    expect(observationParser.parse('observation pesée 1850', ctx)).toBeNull();
    expect(observationParser.parse('je constate le ramassage du matin', ctx)).toBeNull();
  });

  it('ignores a phrase with no observation verb', () => {
    expect(observationParser.parse('les poules vont bien', ctx)).toBeNull();
  });

  it('runs last in the chain', () => {
    // Same phrase, routed by the full chain: the death wins.
    expect(rulesParse('je constate 3 morts', ctx)?.kind).toBe('MORTALITY');
    expect(rulesParse('je constate des boiteries', ctx)?.kind).toBe('HEALTH_OBSERVATION');
  });
});
