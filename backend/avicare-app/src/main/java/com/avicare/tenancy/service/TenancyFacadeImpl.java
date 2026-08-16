package com.avicare.tenancy.service;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.tenancy.api.TenancyFacade;
import com.avicare.tenancy.api.dto.FarmInfo;
import com.avicare.tenancy.api.dto.UserFarmInfo;
import com.avicare.tenancy.domain.UserFarm;
import com.avicare.tenancy.mapper.TenancyMapper;
import com.avicare.tenancy.repository.FarmRepository;
import com.avicare.tenancy.repository.UserFarmRepository;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Default {@link TenancyFacade} implementation. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
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
  public List<Long> listAllFarmIds() {
    return farmRepository.findAllIds();
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
