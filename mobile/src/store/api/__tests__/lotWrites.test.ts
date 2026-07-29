import { poultryBatchesApi } from '../poultryBatchesApi';
import { productionUnitsApi } from '../productionUnitsApi';

it('exposes lot creation endpoints', () => {
  expect(poultryBatchesApi.endpoints.createBatch.name).toBe('createBatch');
  expect(productionUnitsApi.endpoints.createProductionUnit.name).toBe('createProductionUnit');
});
