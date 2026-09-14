package com.avicare.tenancy.api;

import com.avicare.tenancy.api.dto.FarmInfo;
import com.avicare.tenancy.api.dto.UserFarmInfo;
import java.util.List;
import java.util.Map;
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

  /**
   * Every farm on the platform, in one query. Used by the back-office directory: fetching them one
   * by one from {@link #findById} would be an N+1 over the whole tenant base.
   */
  List<FarmInfo> listAllFarms();

  /** Member count per farm, in one query — same reason. */
  Map<Long, Long> memberCountByFarm(List<Long> farmIds);

  /** User ids of the active members of a farm — notification/WhatsApp recipients (Sprint C1). */
  List<Long> listMemberUserIds(Long farmId);

  boolean hasAccess(Long userId, Long farmId);

  Optional<UserFarmInfo> findMembership(Long userId, Long farmId);

  /**
   * The farms this user owns — the ones that disappear with their account.
   *
   * <p>Ownership, not access: a manager or a field worker losing their account leaves the farm
   * untouched, because the farm was never theirs.
   */
  List<Long> listOwnedFarmIds(Long userId);

  /**
   * Erase a farm and everything that cascades from it. <b>Irreversible.</b>
   *
   * <p>Every one of the 28 columns referencing {@code farms(id)} is {@code ON DELETE CASCADE}, so
   * this takes flocks, sales, invoices and expenses with it — and removes the other members' access
   * along the way. The admin console guards the same operation behind a retention delay and a
   * mandatory export ({@code ComplianceService.purgeFarm}); a farmer deleting their own account
   * asks for it directly, so the warning has to be carried by the screen that offers it.
   */
  void purgeFarm(Long farmId);
}
