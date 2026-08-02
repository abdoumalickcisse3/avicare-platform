import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from '@/lib/commercial';

describe('payment method constants', () => {
  it('labels every method in French', () => {
    expect(PAYMENT_METHOD_LABELS.CASH).toBe('Espèces');
    expect(PAYMENT_METHOD_LABELS.MOBILE_MONEY).toBe('Mobile Money');
    expect(PAYMENT_METHOD_LABELS.BANK_TRANSFER).toBe('Virement');
  });

  it('exposes the three methods as options', () => {
    expect(PAYMENT_METHOD_OPTIONS).toEqual(['CASH', 'MOBILE_MONEY', 'BANK_TRANSFER']);
  });
});
