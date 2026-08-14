import { intentFromInterpret } from '../fromInterpret';
import type { InterpretResponse } from '@/store/api/assistantApi';

const draft = (action: string, fields: Record<string, unknown>, unitId: number | null = 3): InterpretResponse => ({
  kind: 'DRAFT',
  action,
  unitId,
  fields,
});

describe('intentFromInterpret', () => {
  it('ignores non-DRAFT responses', () => {
    expect(intentFromInterpret({ kind: 'ANSWER', message: 'x' })).toBeNull();
    expect(intentFromInterpret({ kind: 'CLARIFICATION', message: 'x' })).toBeNull();
  });

  it('maps a VACCINATION draft', () => {
    const intent = intentFromInterpret(
      draft('VACCINATION', { vaccineKey: 'newcastle', vaccineLabel: 'Newcastle', subjectsCount: 500 }),
    );
    expect(intent).toEqual({
      kind: 'VACCINATION',
      vaccineKey: 'newcastle',
      vaccineLabel: 'Newcastle',
      subjectsCount: 500,
      unitId: 3,
    });
  });

  it('maps a CREATE_CLIENT draft (lot-less)', () => {
    const intent = intentFromInterpret(draft('CREATE_CLIENT', { displayName: 'Modou Fall', clientType: 'INDIVIDUAL' }, null));
    expect(intent).toEqual({ kind: 'CREATE_CLIENT', displayName: 'Modou Fall', clientType: 'INDIVIDUAL' });
  });

  it('maps an ADJUST_STOCK draft (lot-less) with the stock item id', () => {
    const intent = intentFromInterpret(
      draft('ADJUST_STOCK', { stockItemId: 11, articleKey: 'aliment', articleSource: 'INVENTORY', delta: -5, before: 40, after: 35, unit: 'sac' }, null),
    );
    expect(intent).toEqual({ kind: 'ADJUST_STOCK', stockItemId: 11, articleKey: 'aliment', delta: -5, unit: 'sac', before: 40, after: 35 });
  });

  it('maps a HEALTH_OBSERVATION draft, keeping optionals when present', () => {
    const intent = intentFromInterpret(
      draft('HEALTH_OBSERVATION', {
        title: 'les poules toussent',
        description: 'depuis ce matin',
        severity: 'CRITICAL',
      }),
    );
    expect(intent).toEqual({
      kind: 'HEALTH_OBSERVATION',
      title: 'les poules toussent',
      description: 'depuis ce matin',
      severity: 'CRITICAL',
      suspectedDisease: undefined,
      unitId: 3,
    });
  });
});
