/**
 * The member sheet: what it submits, and which doors it refuses to open.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MemberSheet } from '../MemberSheet';
import type { Member, PermissionCatalog } from '@/types';

const catalog: PermissionCatalog = {
  resources: [
    { resource: 'poultry', label: 'Élevage volaille', verbs: ['read', 'write', 'delete'] },
    { resource: 'inventory', label: 'Stock', verbs: ['read', 'write', 'consume'] },
  ],
  roleDefaults: {
    OWNER: ['*'],
    MANAGER: ['poultry:*', 'inventory:*'],
    FARMER: ['poultry:read', 'poultry:write', 'inventory:consume'],
    VETERINARIAN: ['poultry:read'],
    BUYER: [],
  },
};

const member: Member = {
  id: 1,
  userId: 3,
  farmId: 7,
  fullName: 'Awa Ndiaye',
  email: 'awa@test.sn',
  phone: null,
  role: 'FARMER',
  permissions: ['poultry:read', 'poultry:write', 'inventory:consume'],
  active: true,
};

const press = async (el: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(el);
  });
};
const type = async (el: Parameters<typeof fireEvent.changeText>[0], text: string) => {
  await act(async () => {
    fireEvent.changeText(el, text);
  });
};

function setup(over: Partial<React.ComponentProps<typeof MemberSheet>> = {}) {
  const handlers = {
    onClose: jest.fn(),
    onCreate: jest.fn(),
    onUpdate: jest.fn(),
    onResetPassword: jest.fn(),
    onToggleActive: jest.fn(),
  };
  const props = { open: true, member: null, catalog, saving: false, ...handlers, ...over };
  return { ...handlers, props };
}

describe('MemberSheet', () => {
  it('never offers the OWNER role, which the backend refuses', async () => {
    // 422 OWNER_NOT_ASSIGNABLE on both create and update — a picker entry would only produce
    // an error the operator cannot act on.
    const { props } = setup();
    await render(<MemberSheet {...props} />);

    expect(screen.queryByLabelText('Rôle Propriétaire')).toBeNull();
    expect(screen.getByLabelText('Rôle Gestionnaire')).toBeTruthy();
  });

  it('creates a member with the role defaults when nothing is customised', async () => {
    const { onCreate, props } = setup();
    await render(<MemberSheet {...props} />);

    await type(screen.getByPlaceholderText('Awa Ndiaye'), 'Moussa Fall');
    await type(screen.getByPlaceholderText('awa@exemple.sn'), 'moussa@test.sn');
    await press(screen.getByLabelText('Créer le compte'));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: 'Moussa Fall',
        email: 'moussa@test.sn',
        role: 'FARMER',
        permissions: ['inventory:consume', 'poultry:read', 'poultry:write'],
      }),
    );
  });

  it('refuses an invalid e-mail before the server has to', async () => {
    const { onCreate, props } = setup();
    await render(<MemberSheet {...props} />);

    await type(screen.getByPlaceholderText('Awa Ndiaye'), 'Moussa Fall');
    await type(screen.getByPlaceholderText('awa@exemple.sn'), 'moussa');
    await press(screen.getByLabelText('Créer le compte'));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByText('Adresse e-mail invalide')).toBeTruthy();
  });

  it('does not ask for a name and e-mail when editing — the endpoint takes neither', async () => {
    const { props } = setup({ member });
    await render(<MemberSheet {...props} />);

    expect(screen.queryByPlaceholderText('Awa Ndiaye')).toBeNull();
    expect(screen.getByText('awa@test.sn')).toBeTruthy();
  });

  it('offers to reactivate a removed member instead of removing them again', async () => {
    const { onToggleActive, props } = setup({ member: { ...member, active: false } });
    await render(<MemberSheet {...props} />);

    expect(screen.queryByLabelText('Retirer ce membre')).toBeNull();
    await press(screen.getByLabelText('Réactiver ce membre'));

    expect(onToggleActive).toHaveBeenCalledWith(true);
  });

  it('reseeds the permissions when the role changes, and says so', async () => {
    const { props } = setup({ member });
    await render(<MemberSheet {...props} />);

    await press(screen.getByLabelText('Rôle Gestionnaire'));

    expect(screen.getByText(/remis à ceux du rôle Gestionnaire/)).toBeTruthy();
  });

  it('explains what a role does, rather than naming it and stopping', async () => {
    const { props } = setup();
    await render(<MemberSheet {...props} />);

    expect(screen.getByText(/Saisit sur le terrain/)).toBeTruthy();
  });
});
