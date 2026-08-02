import { salesApi } from '../salesApi';

it('exposes the createSale endpoint and its hook', () => {
  expect(salesApi.endpoints.createSale.name).toBe('createSale');
  expect(typeof salesApi.useCreateSaleMutation).toBe('function');
});
