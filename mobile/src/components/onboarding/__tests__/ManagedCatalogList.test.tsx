import { fireEvent, render, screen } from '@testing-library/react-native';
import { ManagedCatalogList } from '../ManagedCatalogList';
import { getCategoryConfig } from '@/constants/catalogCategories';

const mockDel = jest.fn(() => ({ unwrap: () => Promise.resolve() }));

jest.mock('@/store/api/catalogApi', () => ({
  useGetCatalogQuery: () => ({
    data: [
      { key: 'mais', value: { label: 'Maïs concassé', subcategory: 'FEED' }, custom: false },
      { key: 'mix', value: { label: 'Mix perso' }, custom: true },
    ],
  }),
  useOverrideCatalogEntryMutation: () => [jest.fn(() => ({ unwrap: () => Promise.resolve() })), {}],
  useDeleteCatalogEntryMutation: () => [mockDel, {}],
}));

beforeEach(() => mockDel.mockClear());

describe('ManagedCatalogList', () => {
  it('renders catalog entries with their origin badge and removes one', async () => {
    await render(<ManagedCatalogList farmId={1} config={getCategoryConfig('stock')!} />);
    expect(screen.getByText('Maïs concassé')).toBeTruthy();
    expect(screen.getByText('Mix perso')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Retirer Mix perso'));
    expect(mockDel).toHaveBeenCalledWith({ farmId: 1, category: 'inventory_items', key: 'mix' });
  });
});
