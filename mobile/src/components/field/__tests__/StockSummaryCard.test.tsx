import { render, screen } from '@testing-library/react-native';
import { StockSummaryCard } from '../StockSummaryCard';
import type { InventorySection } from '@/types/dashboard';

const base: InventorySection = {
  lowStockCount: 2,
  stockValueXof: 450_000,
  pricedArticles: 4,
  totalArticles: 4,
  consumedValueXof: 80_000,
  valuationIncomplete: false,
};

const show = (override: Partial<InventorySection> = {}) =>
  render(<StockSummaryCard data={{ ...base, ...override }} />);

describe('StockSummaryCard', () => {
  it('shows what is on hand, what it is worth and what left', async () => {
    await show();

    expect(screen.getByText('Valeur')).toBeTruthy();
    expect(screen.getByText('Sous le seuil')).toBeTruthy();
    expect(screen.getByText('Consommé (période)')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('warns that the value is a floor when an article has no price', async () => {
    await show({ pricedArticles: 2, totalArticles: 4, valuationIncomplete: true });

    expect(screen.getByText(/2 articles n'ont pas de prix/)).toBeTruthy();
    expect(screen.getByText(/La valeur réelle est plus élevée/)).toBeTruthy();
  });

  it('uses the singular for a single unpriced article', async () => {
    await show({ pricedArticles: 3, totalArticles: 4, valuationIncomplete: true });

    expect(screen.getByText(/1 article n'a pas de prix/)).toBeTruthy();
  });

  it('stays silent when every article is priced', async () => {
    await show();

    expect(screen.queryByText(/pas de prix/)).toBeNull();
  });
});
