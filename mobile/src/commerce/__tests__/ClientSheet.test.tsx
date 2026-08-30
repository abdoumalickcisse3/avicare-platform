/**
 * The client sheet, and the field it must not lose.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ClientSheet } from '../ClientSheet';
import type { Client } from '@/types';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });
const type = (el: Parameters<typeof fireEvent.changeText>[0], text: string): Promise<void> =>
  act(async () => {
    fireEvent.changeText(el, text);
  });

const client: Client = {
  id: 3,
  farmId: 7,
  clientType: 'BUSINESS',
  displayName: 'Boutique Fatou',
  legalName: 'Fatou SARL',
  phone: '770000000',
  email: 'fatou@example.sn',
  address: 'Rue 12',
  city: 'Thiès',
  creditLimitXof: 200000,
  currentBalanceXof: 12000,
  defaultPaymentTerms: '30 jours',
  active: true,
  notes: 'Paie le vendredi',
};

function setup(over: Partial<React.ComponentProps<typeof ClientSheet>> = {}) {
  const onSubmit = jest.fn();
  const props = { open: true, client: null, saving: false, onClose: jest.fn(), onSubmit, ...over };
  return { onSubmit, props };
}

describe('ClientSheet', () => {
  it('round-trips the fields it never shows, because PUT replaces the row', async () => {
    // ClientService.apply reassigns every column — the same trap as PUT /farms/{id}.
    const { onSubmit, props } = setup({ client });
    await render(<ClientSheet {...props} />);

    await type(screen.getByDisplayValue('Boutique Fatou'), 'Boutique Fatou & Fils');
    await press(screen.getByLabelText('Enregistrer le client'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'Boutique Fatou & Fils',
        legalName: 'Fatou SARL',
        email: 'fatou@example.sn',
        address: 'Rue 12',
        defaultPaymentTerms: '30 jours',
        notes: 'Paie le vendredi',
      }),
    );
  });

  it('says the credit limit does not block a sale', async () => {
    const { props } = setup();
    await render(<ClientSheet {...props} />);

    expect(screen.getByText(/elle ne bloque pas la vente/)).toBeTruthy();
  });

  it('refuses a client with no name', async () => {
    const { onSubmit, props } = setup();
    await render(<ClientSheet {...props} />);

    await press(screen.getByLabelText('Créer le client'));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sends null, not an empty string, for a blank optional field', async () => {
    const { onSubmit, props } = setup();
    await render(<ClientSheet {...props} />);

    await type(screen.getByPlaceholderText('Boutique Fatou'), 'Nouveau');
    await press(screen.getByLabelText('Créer le client'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ phone: null, city: null, creditLimitXof: null }),
    );
  });

  it('offers removal only on an existing client', async () => {
    const { props } = setup({ client, onDeactivate: jest.fn() });
    await render(<ClientSheet {...props} />);

    expect(screen.getByLabelText('Retirer ce client')).toBeTruthy();
  });

  it('offers no removal when creating', async () => {
    const { props } = setup({ onDeactivate: jest.fn() });
    await render(<ClientSheet {...props} />);

    expect(screen.queryByLabelText('Retirer ce client')).toBeNull();
  });
});
