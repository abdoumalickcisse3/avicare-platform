import { act, fireEvent, render, screen } from '@testing-library/react-native';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

/**
 * The layer-feed mix-up a pilot farm hit: the platform article "Ponte" had never received a
 * single entry while the farm's own "Pondeuse" held 150 kg. The picker showed neither quantity
 * and named articles after their key, so the two were indistinguishable at the moment of choosing.
 */
const LAYER_STOCK = [
  {
    id: 20,
    farmId: 7,
    articleKey: 'feed_layer',
    label: 'Ponte',
    articleSource: 'INVENTORY',
    currentQuantity: 0,
    unit: 'kg',
    alertThreshold: null,
    typicalUnitPriceXof: 440,
    lastMovementAt: null,
    active: true,
    notes: null,
  },
  {
    id: 10,
    farmId: 7,
    articleKey: 'pondeuse',
    label: 'Pondeuse',
    articleSource: 'INVENTORY',
    currentQuantity: 150,
    unit: 'kg',
    alertThreshold: null,
    typicalUnitPriceXof: 450,
    lastMovementAt: null,
    active: true,
    notes: null,
  },
];

jest.mock('@/store/api/inventoryStockApi', () => ({
  useGetStockItemsQuery: jest.fn(() => ({ data: LAYER_STOCK })),
}));
jest.mock('@/store/api/feedFormulasApi', () => ({
  useGetAvailableFormulasQuery: jest.fn(() => ({ data: { farmFormulas: [], platformFormulas: [] } })),
}));

import { FeedSourceSection } from '../FeedSourceSection';

/** The article chips only exist once the "Article" mode is picked. */
async function openArticlePicker() {
  await render(<FeedSourceSection farmId={7} onChange={jest.fn()} />);
  await press(screen.getByText('Article'));
}

describe('FeedSourceSection — choisir le bon article', () => {
  it("nomme l'article comme l'éleveur le connaît, pas par sa clé", async () => {
    await openArticlePicker();

    expect(screen.getByText('Ponte')).toBeTruthy();
    expect(screen.queryByText('Feed layer')).toBeNull();
  });

  it('affiche ce qui reste de chaque article', async () => {
    await openArticlePicker();

    expect(screen.getByText(/150\s*kg/)).toBeTruthy();
    expect(screen.getByText(/^0\s*kg$/)).toBeTruthy();
  });

  it('propose en premier les articles qui ont du stock', async () => {
    await openArticlePicker();

    const labels = screen.getAllByTestId('feed-article-label').map((n) => n.props.children);
    expect(labels).toEqual(['Pondeuse', 'Ponte']);
  });
});
