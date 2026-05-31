package com.avicare.tenancy.service;

import com.avicare.common.security.principal.Membership;
import com.avicare.identity.spi.MembershipProvider;
import com.avicare.tenancy.repository.UserFarmRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tenancy's implementation of the identity-owned {@link MembershipProvider} seam: turns a user's
 * active {@code user_farms} rows into the {@link Membership} claims stamped into the JWT at
 * login/refresh. This is the only place the two contexts meet for token assembly, and the arrow
 * still points the documented way (tenancy depends on the identity-declared interface).
 */
@Service
@RequiredArgsConstructor
public class MembershipProviderImpl implements MembershipProvider {

  private final UserFarmRepository userFarmRepository;

  @Override
  @Transactional(readOnly = true)
  public List<Membership> membershipsFor(Long userId) {
    return userFarmRepository.findByUserIdAndActiveTrue(userId).stream()
        .map(uf -> new Membership(uf.getFarmId(), uf.getRole(), uf.getPermissions()))
        .toList();
  }
}
