import { canManageFarm, canOperateFarm } from '@/auth/roles';

/**
 * Ces deux prédicats rejouent des règles du backend, pas des préférences d'écran :
 * `WRITE_MANAGER = hasRole(OWNER, MANAGER)` et `WRITE_FARMER = hasRole(OWNER, MANAGER, FARMER)`.
 * Les écrire une fois ici évite que chaque écran s'invente la sienne — ce qui est exactement
 * comment cinq gardes avaient fini par demander une permission à la place d'un rôle.
 */
describe('canManageFarm — écritures de supervision', () => {
  it.each([
    ['OWNER', false, true],
    ['MANAGER', false, true],
    ['FARMER', false, false],
    ['VETERINARIAN', false, false],
    ['BUYER', false, false],
    [undefined, false, false],
  ])('rôle %s (isAdmin=%s) → %s', (role, isAdmin, expected) => {
    expect(canManageFarm(role as string | undefined, isAdmin as boolean)).toBe(expected);
  });

  it("laisse passer un ADMIN de plateforme quel que soit le rôle de ferme", () => {
    expect(canManageFarm('FARMER', true)).toBe(true);
    expect(canManageFarm(undefined, true)).toBe(true);
  });
});

describe('canOperateFarm — écritures de terrain', () => {
  it.each([
    ['OWNER', true],
    ['MANAGER', true],
    ['FARMER', true],
    ['VETERINARIAN', false],
    ['BUYER', false],
    [undefined, false],
  ])('rôle %s → %s', (role, expected) => {
    expect(canOperateFarm(role as string | undefined, false)).toBe(expected);
  });

  it("inclut l'ouvrier, que la supervision exclut", () => {
    // Toute la raison d'être du second prédicat.
    expect(canOperateFarm('FARMER', false)).toBe(true);
    expect(canManageFarm('FARMER', false)).toBe(false);
  });
});
