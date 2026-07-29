import { catalogApi } from '../catalogApi';
import { suppliersApi } from '../suppliersApi';
import { clientsApi } from '../clientsApi';

it('exposes catalog, supplier and client-create endpoints', () => {
  expect(catalogApi.endpoints.getCatalog.name).toBe('getCatalog');
  expect(catalogApi.endpoints.overrideCatalogEntry.name).toBe('overrideCatalogEntry');
  expect(catalogApi.endpoints.deleteCatalogEntry.name).toBe('deleteCatalogEntry');
  expect(suppliersApi.endpoints.createSupplier.name).toBe('createSupplier');
  expect(clientsApi.endpoints.createClient.name).toBe('createClient');
});
