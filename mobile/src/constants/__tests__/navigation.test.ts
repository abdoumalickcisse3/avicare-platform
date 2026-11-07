import { DRAWER_ITEMS, getDrawerItems, getVisibleTabs } from '@/constants/navigation';

describe('role-specific tab bar', () => {
  const ids = (role: string | undefined, isAdmin = false) => getVisibleTabs(role, isAdmin).map((t) => t.id);

  it('FARMER: Accueil, Poulets, Œufs, Sanitaire, Profil', () => {
    expect(ids('FARMER')).toEqual(['home', 'elevage', 'oeufs', 'sanitaire', 'profil']);
  });
  it('VETERINARIAN: Accueil, Poulets, Sanitaire, Profil', () => {
    expect(ids('VETERINARIAN')).toEqual(['home', 'elevage', 'sanitaire', 'profil']);
  });
  it('MANAGER: Accueil, Stock, Commerce, Finance, Profil', () => {
    expect(ids('MANAGER')).toEqual(['home', 'stocks', 'commerce', 'finance', 'profil']);
  });
  it('OWNER / platform ADMIN get the OWNER set (Accueil, Fermes, Stock, Finance, Réglages)', () => {
    expect(ids(undefined, true)).toEqual(['home', 'fermes', 'stocks', 'finance', 'reglages']);
  });
  it('unknown role falls back to FARMER', () => {
    expect(ids('BUYER')).toEqual(['home', 'elevage', 'oeufs', 'sanitaire', 'profil']);
  });
});

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

describe('Souches — déclaration de souche, gardée par le RÔLE (OWNER/MANAGER), pas une permission', () => {
  const allowAll = () => true;

  it("l'écran Souches n'est pas accessible à FARMER", () => {
    expect(getDrawerItems(false, allowAll, [], 'FARMER').some((i) => i.id === 'souches')).toBe(false);
  });

  it("n'est pas accessible à VETERINARIAN non plus", () => {
    expect(getDrawerItems(false, allowAll, [], 'VETERINARIAN').some((i) => i.id === 'souches')).toBe(false);
  });

  it('est accessible à MANAGER et à OWNER', () => {
    expect(getDrawerItems(false, allowAll, [], 'MANAGER').some((i) => i.id === 'souches')).toBe(true);
    expect(getDrawerItems(false, allowAll, [], 'OWNER').some((i) => i.id === 'souches')).toBe(true);
  });

  it("reste accessible à l'ADMIN plateforme même sans rôle de ferme connu", () => {
    expect(getDrawerItems(true, allowAll, []).some((i) => i.id === 'souches')).toBe(true);
  });

  it('ne dépend pas de la permission settings:read/settings:write — un FARMER à qui on l’accorderait à la main reste exclu', () => {
    expect(getDrawerItems(false, allowAll, [], 'FARMER').some((i) => i.id === 'souches')).toBe(false);
  });
});
