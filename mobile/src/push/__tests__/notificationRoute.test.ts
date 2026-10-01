import { hrefFor, NOTIFICATIONS_HREF, parsePushData } from '../notificationRoute';

describe('hrefFor', () => {
  it('opens the lot a notification is about', () => {
    expect(hrefFor({ unitId: 7 })).toBe('/(field)/lots/7');
  });

  it('opens stocks for an item or a purchase order', () => {
    expect(hrefFor({ itemId: 3 })).toBe('/(field)/(tabs)/stocks');
    expect(hrefFor({ purchaseOrderId: 3 })).toBe('/(field)/(tabs)/stocks');
  });

  it('opens invoices and client orders', () => {
    expect(hrefFor({ invoiceId: 1 })).toBe('/(field)/commerce/factures');
    expect(hrefFor({ clientId: 1 })).toBe('/(field)/commerce/commandes');
  });

  it('has no target when the reference is empty or absent', () => {
    expect(hrefFor(null)).toBeNull();
    expect(hrefFor({})).toBeNull();
  });
});

describe('parsePushData', () => {
  it('reads the notification, the farm and the screen from the push data', () => {
    expect(
      parsePushData({ notificationId: 12, farmId: 4, sourceRef: { unitId: 9 } }),
    ).toEqual({ notificationId: 12, farmId: 4, href: '/(field)/lots/9' });
  });

  it('accepts ids that arrived as strings', () => {
    expect(parsePushData({ notificationId: '12', farmId: '4' })).toMatchObject({
      notificationId: 12,
      farmId: 4,
    });
  });

  it('falls back to the bell when the push carries nothing usable', () => {
    for (const data of [undefined, null, 'x', {}, { farmId: 'abc', sourceRef: 'y' }]) {
      expect(parsePushData(data)).toEqual({
        notificationId: null,
        farmId: null,
        href: NOTIFICATIONS_HREF,
      });
    }
  });
});
