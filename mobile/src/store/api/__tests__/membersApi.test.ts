import { membersApi } from '../membersApi';

it('exposes the getMembers endpoint and its hook', () => {
  expect(membersApi.endpoints.getMembers.name).toBe('getMembers');
  expect(typeof membersApi.useGetMembersQuery).toBe('function');
});
