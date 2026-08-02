import { DRAWER_ITEMS, getDrawerItems } from '@/constants/navigation';

describe('commerce navigation', () => {
  it('exposes a ready Vente rapide entry routed to the vente screen', () => {
    const commerce = DRAWER_ITEMS.find((i) => i.id === 'commerce');
    const vente = commerce?.children?.find((c) => c.id === 'ventes');
    expect(vente?.ready).toBe(true);
    expect(vente?.route).toBe('/(field)/commerce/vente');
  });

  it('shows the commerce group (with Vente rapide) to a commercial reader', () => {
    const can = (p: string) => p === 'commercial:read';
    const commerce = getDrawerItems(false, can).find((i) => i.id === 'commerce');
    const ventes = commerce?.children?.find((c) => c.id === 'ventes');
    expect(ventes).toBeTruthy();
    expect(ventes?.route).toBe('/(field)/commerce/vente');
  });
});
