/**
 * Line-by-line reception: what it pre-fills, and the two consequences it must state.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ReceptionSheet } from '../ReceptionSheet';
import type { PurchaseOrder } from '@/types';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });
const type = (el: Parameters<typeof fireEvent.changeText>[0], text: string): Promise<void> =>
  act(async () => {
    fireEvent.changeText(el, text);
  });

const order = {
  id: 4,
  farmId: 7,
  orderNumber: 'BA-2026-004',
  status: 'SENT',
  items: [
    { id: 11, articleKey: 'mais', articleSource: 'INVENTORY', orderedQuantity: 100, receivedQuantity: 0, unit: 'kg', unitPriceXof: 300 },
    { id: 12, articleKey: 'tourteau', articleSource: 'INVENTORY', orderedQuantity: 50, receivedQuantity: 0, unit: 'kg', unitPriceXof: 500 },
  ],
} as unknown as PurchaseOrder;

function setup(over: Partial<React.ComponentProps<typeof ReceptionSheet>> = {}) {
  const onSubmit = jest.fn();
  const props = { open: true, order, saving: false, onClose: jest.fn(), onSubmit, ...over };
  return { onSubmit, props };
}

describe('ReceptionSheet', () => {
  it('pre-fills every line with the ordered quantity, the common case', async () => {
    const { onSubmit, props } = setup();
    await render(<ReceptionSheet {...props} />);

    await press(screen.getByLabelText('Valider la réception'));

    expect(onSubmit).toHaveBeenCalledWith([
      { itemId: 11, receivedQuantity: 100 },
      { itemId: 12, receivedQuantity: 50 },
    ]);
  });

  it('shows the expense the reception will book, before it is booked', async () => {
    // 100 × 300 + 50 × 500 = 55 000, and this goes to the finance ledger.
    const { props } = setup();
    await render(<ReceptionSheet {...props} />);

    expect(screen.getByText(/55[\s ]?000/)).toBeTruthy();
    expect(screen.getByText(/écrit cette dépense dans votre comptabilité/)).toBeTruthy();
  });

  it('warns that a short line closes the order for good', async () => {
    // The service sets RECEIVED unconditionally — there is no partially-received state.
    const { props } = setup();
    await render(<ReceptionSheet {...props} />);

    await type(screen.getByLabelText('Quantité reçue Mais'), '60');

    expect(screen.getByText(/ne pourra plus être reçu dessus/)).toBeTruthy();
    expect(screen.getByText('Manque 40')).toBeTruthy();
  });

  it('recomputes the expense from what was actually received', async () => {
    const { props } = setup();
    await render(<ReceptionSheet {...props} />);

    await type(screen.getByLabelText('Quantité reçue Mais'), '60');

    // 60 × 300 + 50 × 500 = 43 000.
    expect(screen.getByText(/43[\s ]?000/)).toBeTruthy();
  });

  it('refuses a reception where nothing arrived at all', async () => {
    const { onSubmit, props } = setup();
    await render(<ReceptionSheet {...props} />);

    await type(screen.getByLabelText('Quantité reçue Mais'), '0');
    await type(screen.getByLabelText('Quantité reçue Tourteau'), '0');
    await press(screen.getByLabelText('Valider la réception'));

    // Closing an order having received nothing is a cancellation, and there is a button for that.
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the corrected quantities, not the ordered ones', async () => {
    const { onSubmit, props } = setup();
    await render(<ReceptionSheet {...props} />);

    await type(screen.getByLabelText('Quantité reçue Tourteau'), '48');
    await press(screen.getByLabelText('Valider la réception'));

    expect(onSubmit).toHaveBeenCalledWith([
      { itemId: 11, receivedQuantity: 100 },
      { itemId: 12, receivedQuantity: 48 },
    ]);
  });
});
