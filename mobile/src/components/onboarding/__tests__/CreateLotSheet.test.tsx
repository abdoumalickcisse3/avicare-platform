/**
 * The onboarding lot-creation sheet. Chick-purchase price is a broiler-batch
 * concept (this feature's scope) — layer flocks go through a different
 * creation path and must show no such field.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { CreateLotSheet } from '../CreateLotSheet';

const mockCreateBatch = jest.fn((_args: { farmId: number; body: Record<string, unknown> }) => ({
  unwrap: () => Promise.resolve({}),
}));
const mockCreateUnit = jest.fn((_args: { farmId: number; body: Record<string, unknown> }) => ({
  unwrap: () => Promise.resolve({}),
}));

jest.mock('@/store/api/breedsApi', () => ({
  useListBreedsQuery: () => ({
    data: [
      { id: 9, name: 'Cobb 500', type: 'broiler', species: 'POULTRY' },
      { id: 10, name: 'ISA Brown', type: 'layer', species: 'POULTRY' },
    ],
  }),
}));
jest.mock('@/store/api/poultryBatchesApi', () => ({
  useCreateBatchMutation: () => [mockCreateBatch, { isLoading: false }],
}));
jest.mock('@/store/api/productionUnitsApi', () => ({
  useCreateProductionUnitMutation: () => [mockCreateUnit, { isLoading: false }],
}));

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });
const type = (el: Parameters<typeof fireEvent.changeText>[0], text: string): Promise<void> =>
  act(async () => {
    fireEvent.changeText(el, text);
  });

describe('CreateLotSheet', () => {
  beforeEach(() => {
    mockCreateBatch.mockClear();
    mockCreateUnit.mockClear();
  });

  it('sends chickUnitPriceXof when a chick price is typed on a broiler lot', async () => {
    await render(<CreateLotSheet visible kind="broiler" farmId={1} onClose={jest.fn()} />);

    await press(screen.getByLabelText('Cobb 500'));
    await type(screen.getByLabelText('Effectif'), '500');
    await type(screen.getByLabelText('Prix par poussin (FCFA, optionnel)'), '300');
    await press(screen.getByLabelText('Créer le lot'));

    expect(mockCreateBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        farmId: 1,
        body: expect.objectContaining({ chickUnitPriceXof: 300 }),
      }),
    );
  });

  it('omits chickUnitPriceXof when left blank', async () => {
    await render(<CreateLotSheet visible kind="broiler" farmId={1} onClose={jest.fn()} />);

    await press(screen.getByLabelText('Cobb 500'));
    await type(screen.getByLabelText('Effectif'), '500');
    await press(screen.getByLabelText('Créer le lot'));

    expect(mockCreateBatch).toHaveBeenCalled();
    const body = mockCreateBatch.mock.calls[0]?.[0].body;
    expect(body).not.toHaveProperty('chickUnitPriceXof');
  });

  it('shows no chick-price field for a layer lot', async () => {
    await render(<CreateLotSheet visible kind="layer" farmId={1} onClose={jest.fn()} />);

    expect(screen.queryByLabelText('Prix par poussin (FCFA, optionnel)')).toBeNull();
  });
});
