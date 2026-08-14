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
