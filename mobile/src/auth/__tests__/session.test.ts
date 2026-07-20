import { Buffer } from 'buffer';
import { decodeSession, hasFieldAccess } from '../session';

const payload = {
  sub: '42',
  role: 'USER',
  memberships: [{ farmId: 7, farmRole: 'FARMER', permissions: ['livestock:write'] }],
};
const token = `x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.y`;

describe('decodeSession', () => {
  it('reads userId, role and memberships from the JWT claims', () => {
    const session = decodeSession(token);
    expect(session.userId).toBe(42);
    expect(session.memberships[0]?.farmId).toBe(7);
  });

  it('grants field access to FARMER but not to BUYER', () => {
    expect(hasFieldAccess(decodeSession(token))).toBe(true);
    const buyer = { ...payload, memberships: [{ farmId: 7, farmRole: 'BUYER', permissions: [] }] };
    const buyerToken = `x.${Buffer.from(JSON.stringify(buyer)).toString('base64url')}.y`;
    expect(hasFieldAccess(decodeSession(buyerToken))).toBe(false);
  });
});
