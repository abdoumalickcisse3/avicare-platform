package com.avicare.tenancy.api;

import com.avicare.tenancy.api.dto.FarmInfo;
import com.avicare.tenancy.api.dto.UserFarmInfo;
import java.util.List;
import java.util.Optional;

/**
 * Public contract of the tenancy bounded context (docs/03 §4.2). {@link
 * #getAccessibleFarmIds(Long)} is the centralized multi-tenancy lookup called wherever queries must
 * be scoped to a user's farms.
 */
public interface TenancyFacade {

  /**
   * @throws com.avicare.common.api.exception.NotFoundException if no farm has this id
   */
  FarmInfo findById(Long farmId);

  List<Long> getAccessibleFarmIds(Long userId);

  /** Ids of all farms (non-soft-deleted) — for the daily notification scan (Sprint C1). */
  List<Long> listAllFarmIds();

  /** User ids of the active members of a farm — notification/WhatsApp recipients (Sprint C1). */
  List<Long> listMemberUserIds(Long farmId);

  boolean hasAccess(Long userId, Long farmId);

  Optional<UserFarmInfo> findMembership(Long userId, Long farmId);
}
