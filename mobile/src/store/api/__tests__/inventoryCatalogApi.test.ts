import { inventoryCatalogApi } from '../inventoryCatalogApi';
import { feedFormulasApi } from '../feedFormulasApi';

it('exposes the inventory catalog endpoints and their hooks', () => {
  expect(inventoryCatalogApi.endpoints.getInventoryArticles.name).toBe('getInventoryArticles');
  expect(inventoryCatalogApi.endpoints.getPlatformFormulas.name).toBe('getPlatformFormulas');
  expect(typeof inventoryCatalogApi.useGetInventoryArticlesQuery).toBe('function');
  expect(typeof inventoryCatalogApi.useCreateArticleMutation).toBe('function');
  expect(typeof inventoryCatalogApi.useDeleteArticleMutation).toBe('function');
});

it('exposes the feed-formula write actions and their hooks', () => {
  expect(feedFormulasApi.endpoints.cloneFeedFormula.name).toBe('cloneFeedFormula');
  expect(feedFormulasApi.endpoints.recomputeFormulaCost.name).toBe('recomputeFormulaCost');
  expect(feedFormulasApi.endpoints.deactivateFeedFormula.name).toBe('deactivateFeedFormula');
  expect(typeof feedFormulasApi.useCloneFeedFormulaMutation).toBe('function');
});
