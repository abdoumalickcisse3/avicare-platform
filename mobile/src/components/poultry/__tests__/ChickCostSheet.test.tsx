import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ChickCostSheet } from '../ChickCostSheet';

const mockSetChickCost = jest.fn(() => ({ unwrap: () => Promise.resolve({}) }));

jest.mock('@/store/api/poultryBatchesApi', () => ({
  useSetChickCostMutation: () => [mockSetChickCost, { isLoading: false }],
}));

describe('ChickCostSheet', () => {
  beforeEach(() => {
    mockSetChickCost.mockClear();
  });

  it('envoie chickUnitPriceXof et ferme la feuille', async () => {
    const onClose = jest.fn();
    await render(
      <ChickCostSheet
        visible
        onClose={onClose}
        farmId={1}
        batchId={42}
        initialCount={500}
        currentValueXof={null}
      />,
    );

    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Prix par poussin (FCFA)'), '300'),
    );
    await act(async () => fireEvent.press(screen.getByLabelText('Enregistrer')));

    expect(mockSetChickCost).toHaveBeenCalledWith({
      farmId: 1,
      batchId: 42,
      body: { chickUnitPriceXof: 300 },
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('pré-remplit le prix unitaire déjà enregistré pour permettre une correction', async () => {
    await render(
      <ChickCostSheet
        visible
        onClose={jest.fn()}
        farmId={1}
        batchId={42}
        initialCount={500}
        currentValueXof={150_000}
      />,
    );

    expect(screen.getByLabelText('Prix par poussin (FCFA)').props.value).toBe('300');
    expect(screen.getByText('Modifier le coût des poussins')).toBeTruthy();
  });
});
