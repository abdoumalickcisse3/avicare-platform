import { financeApi } from '../financeApi';

it('exposes the expense endpoints and their hooks', () => {
  expect(financeApi.endpoints.getExpenses.name).toBe('getExpenses');
  expect(financeApi.endpoints.createExpense.name).toBe('createExpense');
  expect(typeof financeApi.useGetExpensesQuery).toBe('function');
  expect(typeof financeApi.useCreateExpenseMutation).toBe('function');
});

it('exposes the farm analytics endpoint and its hook', () => {
  expect(financeApi.endpoints.getFarmAnalytics.name).toBe('getFarmAnalytics');
  expect(typeof financeApi.useGetFarmAnalyticsQuery).toBe('function');
});

it('exposes the salary endpoints and their hooks', () => {
  expect(financeApi.endpoints.getSalaries.name).toBe('getSalaries');
  expect(financeApi.endpoints.paySalary.name).toBe('paySalary');
  expect(typeof financeApi.useGetSalariesQuery).toBe('function');
  expect(typeof financeApi.usePaySalaryMutation).toBe('function');
});
