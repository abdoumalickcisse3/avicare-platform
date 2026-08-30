import {
  expandPermissions,
  grantedCount,
  matchesRoleDefaults,
  toggleVerb,
  verbLabel,
} from '../permissions';
import type { PermissionCatalog } from '@/types';

const catalog: PermissionCatalog = {
  resources: [
    { resource: 'poultry', label: 'Élevage volaille', verbs: ['read', 'write', 'delete'] },
    { resource: 'inventory', label: 'Stock', verbs: ['read', 'write', 'consume'] },
  ],
  roleDefaults: {
    OWNER: ['*'],
    FARMER: ['poultry:read', 'poultry:write', 'inventory:consume'],
  },
};

describe('expandPermissions', () => {
  it('expands the global wildcard across every module and verb', () => {
    expect(expandPermissions(['*'], catalog).size).toBe(6);
  });

  it('expands a module wildcard to that module only', () => {
    expect([...expandPermissions(['poultry:*'], catalog)].sort()).toEqual([
      'poultry:delete',
      'poultry:read',
      'poultry:write',
    ]);
  });

  it('ignores a verb the catalog does not declare', () => {
    // The catalog is the authority; a stale permission string must not invent a toggle.
    expect(expandPermissions(['poultry:archive'], catalog).size).toBe(0);
  });
});

describe('toggleVerb', () => {
  const verbs = ['read', 'write', 'delete'];

  it('grants read alongside any other verb', () => {
    // Menu and lists are gated on `resource:read`: write without read is an account that
    // cannot reach a single screen.
    expect(toggleVerb(new Set(), 'poultry', 'write', true, verbs)).toEqual([
      'poultry:read',
      'poultry:write',
    ]);
  });

  it('revokes the whole module when read is revoked', () => {
    const current = new Set(['poultry:read', 'poultry:write', 'poultry:delete']);
    expect(toggleVerb(current, 'poultry', 'read', false, verbs)).toEqual([]);
  });

  it('keeps consume when read is revoked, which is the FARMER baseline', () => {
    // The platform itself grants `inventory:consume` without `inventory:read`: a field worker
    // draws feed from the daily-entry screen and never opens the stock section.
    const current = new Set(['inventory:read', 'inventory:consume']);
    expect(toggleVerb(current, 'inventory', 'read', false, ['read', 'write', 'consume'])).toEqual([
      'inventory:consume',
    ]);
  });

  it('revokes one verb without touching the others', () => {
    const current = new Set(['poultry:read', 'poultry:write']);
    expect(toggleVerb(current, 'poultry', 'write', false, verbs)).toEqual(['poultry:read']);
  });

  it('leaves other modules alone', () => {
    const current = new Set(['inventory:read', 'poultry:read']);
    expect(toggleVerb(current, 'poultry', 'read', false, verbs)).toEqual(['inventory:read']);
  });

  it('grants consume alone — no implied read, or it would exceed the role it copied', () => {
    expect(
      toggleVerb(new Set(), 'inventory', 'consume', true, ['read', 'write', 'consume']),
    ).toEqual(['inventory:consume']);
  });
});

describe('grantedCount', () => {
  it('counts only the verbs the module declares', () => {
    const selected = new Set(['poultry:read', 'poultry:write', 'inventory:read']);
    expect(grantedCount(selected, 'poultry', ['read', 'write', 'delete'])).toBe(2);
  });
});

describe('matchesRoleDefaults', () => {
  it('recognises an untouched role baseline', () => {
    const selected = expandPermissions(catalog.roleDefaults.FARMER ?? [], catalog);
    expect(matchesRoleDefaults(selected, 'FARMER', catalog)).toBe(true);
  });

  it('detects one added permission', () => {
    const selected = expandPermissions(catalog.roleDefaults.FARMER ?? [], catalog);
    selected.add('poultry:delete');
    expect(matchesRoleDefaults(selected, 'FARMER', catalog)).toBe(false);
  });

  it('detects one removed permission', () => {
    const selected = expandPermissions(catalog.roleDefaults.FARMER ?? [], catalog);
    selected.delete('poultry:write');
    expect(matchesRoleDefaults(selected, 'FARMER', catalog)).toBe(false);
  });
});

describe('verbLabel', () => {
  it('names the verbs in the operator\'s words, not the API\'s', () => {
    expect(verbLabel('read')).toBe('Voir');
    expect(verbLabel('consume')).toBe('Consommer');
  });

  it('falls back to the raw verb rather than rendering nothing', () => {
    expect(verbLabel('archive')).toBe('archive');
  });
});
