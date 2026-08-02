import { DRAWER_ITEMS, getDrawerItems } from '@/constants/navigation';

describe('navigation mirrors the web sidebar', () => {
  const commercial = DRAWER_ITEMS.find((i) => i.id === 'commercial');

  it('commercial group lists the web pages: Clients, Commandes, Ventes, Factures', () => {
    expect(commercial?.children?.map((c) => c.label)).toEqual([
      'Clients',
      'Commandes',
      'Ventes',
      'Factures',
    ]);
  });

  it('hides the commercial group unless commercial:read is granted', () => {
    const none = () => false;
    expect(getDrawerItems(false, none, []).some((i) => i.id === 'commercial')).toBe(false);
    const commercialReader = (p: string) => p === 'commercial:read';
    expect(getDrawerItems(false, commercialReader, []).some((i) => i.id === 'commercial')).toBe(true);
  });

  it('filters Œufs out of Élevage on a broiler-only farm (focus)', () => {
    const poultryReader = (p: string) => p === 'poultry:read';
    const elevage = getDrawerItems(false, poultryReader, ['broiler']).find((i) => i.id === 'elevage');
    const labels = elevage?.children?.map((c) => c.label) ?? [];
    expect(labels).toContain('Poulets de chair');
    expect(labels).not.toContain('Œufs');
  });

  it('shows both Élevage leaves when the farm has no declared focus', () => {
    const poultryReader = (p: string) => p === 'poultry:read';
    const elevage = getDrawerItems(false, poultryReader, []).find((i) => i.id === 'elevage');
    const labels = elevage?.children?.map((c) => c.label) ?? [];
    expect(labels).toEqual(expect.arrayContaining(['Poulets de chair', 'Œufs']));
  });
});
