import { Buffer } from 'buffer';
import { decodeSession, hasFieldAccess } from '../session';

/**
 * Builds a base64url string WITHOUT relying on Buffer's `'base64url'`
 * encoding — only `'base64'` is used, then converted by hand. This mirrors
 * what a real JWT looks like on the wire and, critically, does NOT rely on
 * Node-core `Buffer` behaviour that the on-device `buffer` polyfill lacks.
 * If this helper (or `decodeSession`) ever regresses to passing
 * `'base64url'` straight to `Buffer.from`, this test suite stops being
 * representative of the real, on-device Metro/Hermes bundle.
 */
function toBase64Url(json: string): string {
  return Buffer.from(json)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const payload = {
  sub: '42',
  role: 'USER',
  memberships: [{ farmId: 7, farmRole: 'FARMER', permissions: ['livestock:write'] }],
};
const token = `x.${toBase64Url(JSON.stringify(payload))}.y`;

describe('decodeSession', () => {
  it('reads userId, role and memberships from the JWT claims', () => {
    const session = decodeSession(token);
    expect(session.userId).toBe(42);
    expect(session.memberships[0]?.farmId).toBe(7);
  });

  it('grants field access to FARMER but not to BUYER', () => {
    expect(hasFieldAccess(decodeSession(token))).toBe(true);
    const buyer = { ...payload, memberships: [{ farmId: 7, farmRole: 'BUYER', permissions: [] }] };
    const buyerToken = `x.${toBase64Url(JSON.stringify(buyer))}.y`;
    expect(hasFieldAccess(decodeSession(buyerToken))).toBe(false);
  });

  it('decodes a payload whose base64url form needs unpadding and -/_ substitution', () => {
    // The `>` permission value is deliberately chosen: its byte lands in the
    // final 6-bit group of a base64 block, which is the only group that can
    // ever equal 62 ('+' -> '-') or 63 ('/' -> '_') when every source byte is
    // plain ASCII (see std base64 bit-packing). Combined with dropped
    // padding (`=` stripped, length not a multiple of 4), this token forces
    // decodeSession's re-pad-and-substitute path to actually execute — the
    // exact path the original `Buffer.from(part, 'base64url')` bug skipped
    // in Jest (Node-core Buffer) but broke on-device (Hermes polyfill).
    const special = {
      sub: '42',
      role: 'USER',
      memberships: [{ farmId: 7, farmRole: 'FARMER', permissions: ['>'] }],
    };
    const encoded = toBase64Url(JSON.stringify(special));
    expect(encoded).toMatch(/[-_]/);
    expect(encoded.length % 4).not.toBe(0);

    const specialToken = `x.${encoded}.y`;
    const session = decodeSession(specialToken);
    expect(session.userId).toBe(42);
    expect(session.memberships).toEqual([
      { farmId: 7, farmRole: 'FARMER', permissions: ['>'] },
    ]);
  });
});
