package com.avicare.tenancy.service;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.security.principal.FarmRole;
import com.avicare.tenancy.api.TenancyFacade;
import com.avicare.tenancy.api.dto.FarmInfo;
import com.avicare.tenancy.api.dto.UserFarmInfo;
import com.avicare.tenancy.domain.UserFarm;
import com.avicare.tenancy.mapper.TenancyMapper;
import com.avicare.tenancy.repository.FarmRepository;
import com.avicare.tenancy.repository.UserFarmRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Default {@link TenancyFacade} implementation. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@Slf4j
public class TenancyFacadeImpl implements TenancyFacade {

  private final FarmRepository farmRepository;
  private final UserFarmRepository userFarmRepository;
  private final TenancyMapper tenancyMapper;

  @Override
  public FarmInfo findById(Long farmId) {
    return farmRepository
        .findById(farmId)
        .map(tenancyMapper::toInfo)
        .orElseThrow(() -> NotFoundException.of("Farm", farmId));
  }

  @Override
  public List<Long> getAccessibleFarmIds(Long userId) {
    return userFarmRepository.findByUserIdAndActiveTrue(userId).stream()
        .map(UserFarm::getFarmId)
        .toList();
  }

  @Override
  @Transactional(readOnly = true)
  public List<Long> listOwnedFarmIds(Long userId) {
    // `findByUserId`, not the active-only variant: a suspended membership still owns the farm, and
    // an account being deleted must not leave one behind because its row was inactive.
    return userFarmRepository.findByUserId(userId).stream()
        .filter(m -> m.getRole() == FarmRole.OWNER)
        .map(UserFarm::getFarmId)
        .toList();
  }

  @Override
  @Transactional
  public void purgeFarm(Long farmId) {
    farmRepository.hardDeleteById(farmId);
    log.warn("Farm {} purged", farmId);
  }

  @Override
  public List<Long> listAllFarmIds() {
    return farmRepository.findAllIds();
  }

  @Override
  @Transactional(readOnly = true)
  public List<FarmInfo> listAllFarms() {
    return farmRepository.findAll().stream().map(tenancyMapper::toInfo).toList();
  }

  @Override
  @Transactional(readOnly = true)
  public Map<Long, Long> memberCountByFarm(List<Long> farmIds) {
    if (farmIds == null || farmIds.isEmpty()) {
      return Map.of();
    }
    Map<Long, Long> out = new HashMap<>();
    for (Long farmId : farmIds) {
      out.put(farmId, (long) userFarmRepository.findByFarmIdAndActiveTrue(farmId).size());
    }
    return out;
  }

  @Override
  public List<Long> listMemberUserIds(Long farmId) {
    return userFarmRepository.findByFarmIdAndActiveTrue(farmId).stream()
        .map(UserFarm::getUserId)
        .toList();
  }

  @Override
  public boolean hasAccess(Long userId, Long farmId) {
    return userFarmRepository
        .findByUserIdAndFarmId(userId, farmId)
        .map(UserFarm::isActive)
        .orElse(false);
  }

  @Override
  public Optional<UserFarmInfo> findMembership(Long userId, Long farmId) {
    return userFarmRepository.findByUserIdAndFarmId(userId, farmId).map(tenancyMapper::toInfo);
  }
}
