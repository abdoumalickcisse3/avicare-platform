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

  it('maps a RECORD_PAYMENT draft (lot-less, online)', () => {
    const intent = intentFromInterpret(
      draft('RECORD_PAYMENT', { invoiceId: 42, invoiceNumber: 'FAC-2026-042', clientName: 'Diallo', amountXof: 30000, method: 'MOBILE_MONEY' }, null),
    );
    expect(intent).toEqual({
      kind: 'RECORD_PAYMENT',
      invoiceId: 42,
      invoiceNumber: 'FAC-2026-042',
      clientName: 'Diallo',
      amountXof: 30000,
      method: 'MOBILE_MONEY',
    });
  });

  it('maps a QUICK_SALE draft (broiler, with lot)', () => {
    const intent = intentFromInterpret(
      draft('QUICK_SALE', { productType: 'BROILER', quantity: 30, unitName: 'B-12', unitPriceXof: 2500, availableAfter: 90 }, 3),
    );
    expect(intent).toEqual({
      kind: 'QUICK_SALE',
      productType: 'BROILER',
      quantity: 30,
      unitId: 3,
      unitName: 'B-12',
      unitPriceXof: 2500,
      availableAfter: 90,
    });
  });

  it('maps a PURCHASE draft with the resolved supplier id', () => {
    const intent = intentFromInterpret(
      draft('PURCHASE', { articleKey: 'aliment', articleSource: 'INVENTORY', quantity: 10, supplierId: 3, supplierName: 'Sahel', unitPriceXof: 15000 }, null),
    );
    expect(intent).toMatchObject({ kind: 'PURCHASE', articleKey: 'aliment', quantity: 10, supplierId: 3, unitPriceXof: 15000 });
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
