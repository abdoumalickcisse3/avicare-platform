import { ONBOARDING_STEPS } from '../steps';

it('has the seven ordered steps', () => {
  expect(ONBOARDING_STEPS.map((s) => s.id)).toEqual([
    'welcome',
    'farm',
    'livestock',
    'stock',
    'commercial',
    'finance',
    'done',
  ]);
});
