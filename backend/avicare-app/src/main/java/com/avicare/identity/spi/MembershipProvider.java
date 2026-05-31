package com.avicare.identity.spi;

import com.avicare.common.security.principal.Membership;
import java.util.List;

/**
 * Inversion-of-control seam so the identity context can stamp a user's farm memberships into the
 * JWT at login/refresh <b>without</b> depending on the tenancy context.
 *
 * <p>The dependency arrow documented in docs/03 is {@code tenancy → identity}; identity must not
 * depend on tenancy. So identity <b>declares</b> this interface and tenancy <b>implements</b> it
 * ({@code MembershipProviderImpl}). {@code AuthService} depends only on this identity-owned type.
 *
 * <p>A no-op default implementation lives in identity so the context is self-sufficient (e.g. in
 * slice tests) when tenancy is absent.
 */
public interface MembershipProvider {

  /** The active farm memberships of the user, as principal claims. Never {@code null}. */
  List<Membership> membershipsFor(Long userId);
}
