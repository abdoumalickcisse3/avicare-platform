/**
 * HealthCatalogSheet: one sheet for a custom vaccine or a custom medication.
 *
 * The medication half carries the stock side too (ADR-020). Before the bridge, adding a medication
 * here wrote the medical sheet alone: the farmer got a treatment they could never buy, receive or
 * decrement, and the product they had actually bought — declared in Stock — stayed invisible to
 * the treatment form.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { HealthCatalogSheet } from '../HealthCatalogSheet';

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

describe('HealthCatalogSheet', () => {
  it('emits a medication carrying both its medical and its stock fields', async () => {
    const onSubmit = jest.fn();
    await act(async () => {
      render(
        <HealthCatalogSheet
          open
          kind="treatment"
          entry={null}
          existingKeys={[]}
          saving={false}
          onClose={jest.fn()}
          onSubmit={onSubmit}
        />,
      );
    });

    await type(screen.getByLabelText('Nom'), 'Hepaturyl');
    await type(screen.getByLabelText('Molécule'), 'sorbitol');
    await type(screen.getByLabelText("Délai d'attente viande (jours)"), '7');
    await type(screen.getByLabelText("Délai d'attente œufs (jours)"), '3');
    await type(screen.getByLabelText('Unité de stock'), 'L');
    await type(screen.getByLabelText('Prix moyen (XOF)'), '4500');
    await press(screen.getByLabelText('Enregistrer'));

    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'treatment',
      body: {
        key: 'hepaturyl',
        label: 'Hepaturyl',
        molecule: 'sorbitol',
        routes: [],
        withdrawalDaysMeat: 7,
        withdrawalDaysEggs: 3,
        unit: 'L',
        typicalUnitPriceXof: 4500,
      },
    });
  });

  it('still emits a vaccine as a catalog value map', async () => {
    const onSubmit = jest.fn();
    await act(async () => {
      render(
        <HealthCatalogSheet
          open
          kind="vaccine"
          entry={null}
          existingKeys={[]}
          saving={false}
          onClose={jest.fn()}
          onSubmit={onSubmit}
        />,
      );
    });

    await type(screen.getByLabelText('Nom'), 'Newcastle La Sota');
    await type(screen.getByLabelText('Maladie ciblée'), 'Newcastle');
    await press(screen.getByLabelText('Enregistrer'));

    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'vaccine',
      key: 'newcastle-la-sota',
      value: { label: 'Newcastle La Sota', disease: 'Newcastle' },
    });
  });

  it('asks a vaccine for no stock unit — only a medication is stocked', async () => {
    await act(async () => {
      render(
        <HealthCatalogSheet
          open
          kind="vaccine"
          entry={null}
          existingKeys={[]}
          saving={false}
          onClose={jest.fn()}
          onSubmit={jest.fn()}
        />,
      );
    });

    expect(screen.queryByLabelText('Unité de stock')).toBeNull();
  });
});
