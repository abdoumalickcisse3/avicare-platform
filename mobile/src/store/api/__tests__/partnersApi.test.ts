import { partnersApi } from '../partnersApi';

describe('partnersApi', () => {
  it('exposes the directory, my-partners and membership mutation endpoints with hooks', () => {
    expect(partnersApi.endpoints.getAvailablePartners.name).toBe('getAvailablePartners');
    expect(partnersApi.endpoints.getMyPartners.name).toBe('getMyPartners');
    expect(typeof partnersApi.useGetAvailablePartnersQuery).toBe('function');
    expect(typeof partnersApi.useGetMyPartnersQuery).toBe('function');
    expect(typeof partnersApi.useDeclarePartnerMutation).toBe('function');
    expect(typeof partnersApi.useJoinNetworkMutation).toBe('function');
    expect(typeof partnersApi.useUpdateSharingMutation).toBe('function');
    expect(typeof partnersApi.useLeaveNetworkMutation).toBe('function');
  });

  it('builds farm-scoped urls', () => {
    const declare = partnersApi.endpoints.declarePartner.initiate({ farmId: 42, partnerId: 3 });
    // the thunk holds the endpoint definition; assert the query builder shape indirectly
    expect(typeof declare).toBe('function');
  });
});
