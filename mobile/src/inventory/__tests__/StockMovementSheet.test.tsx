import { act, fireEvent, render, screen } from '@testing-library/react-native';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });
const type = (el: Parameters<typeof fireEvent.changeText>[0], t: string): Promise<void> =>
  act(async () => {
    fireEvent.changeText(el, t);
  });

const mockRecord = jest.fn(() => ({ unwrap: () => Promise.resolve({}) }));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('@/store/api/inventoryStockApi', () => ({
  useRecordMovementMutation: jest.fn(() => [mockRecord, { isLoading: false }]),
}));

import { StockMovementSheet } from '@/inventory/StockMovementSheet';

const item = { id: 9, farmId: 7, articleKey: 'FEED_STARTER', articleSource: 'INVENTORY', currentQuantity: 100, unit: 'kg', alertThreshold: null, typicalUnitPriceXof: null, lastMovementAt: null, active: true, notes: null } as const;

describe('StockMovementSheet', () => {
  beforeEach(() => mockRecord.mockClear());

  it('records an IN movement with a quantity and reason', async () => {
    await render(<StockMovementSheet farmId={7} item={item as never} name="Aliment démarrage" open onClose={jest.fn()} onDone={jest.fn()} />);
    await type(screen.getByLabelText('Quantité'), '50');
    await press(screen.getByLabelText('Enregistrer le mouvement'));
    expect(mockRecord).toHaveBeenCalledWith({
      farmId: 7,
      body: expect.objectContaining({ stockItemId: 9, movementType: 'IN', quantity: 50, reason: 'RECEPTION_PURCHASE' }),
    });
  });
});
