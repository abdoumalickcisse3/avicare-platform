package com.avicare.tenancy.service;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.security.principal.FarmRole;
import com.avicare.tenancy.domain.Farm;
import com.avicare.tenancy.domain.UserFarm;
import com.avicare.tenancy.dto.request.CreateFarmRequest;
import com.avicare.tenancy.dto.request.UpdateFarmRequest;
import com.avicare.tenancy.dto.response.FarmResponse;
import com.avicare.tenancy.mapper.TenancyMapper;
import com.avicare.tenancy.repository.FarmRepository;
import com.avicare.tenancy.repository.UserFarmRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Farm CRUD. Creating a farm also grants the creator an {@code OWNER} membership with the role's
 * default permissions, so a brand-new farm is immediately reachable by its creator.
 *
 * <p>Listing is multi-tenant: a regular user sees only farms they are a member of (Règle 6 — never
 * filter by {@code createdBy} alone); a platform admin sees all.
 */
@Service
@RequiredArgsConstructor
public class FarmService {

  private final FarmRepository farmRepository;
  private final UserFarmRepository userFarmRepository;
  private final TenancyMapper tenancyMapper;

  @Transactional
  public FarmResponse create(Long creatorUserId, CreateFarmRequest request) {
    Farm farm = new Farm();
    farm.setName(request.name());
    farm.setDescription(request.description());
    farm.setLocation(request.location());
    farm.setGpsLatitude(request.gpsLatitude());
    farm.setGpsLongitude(request.gpsLongitude());
    farm.setCapacity(request.capacity());
    if (request.timezone() != null && !request.timezone().isBlank()) {
      farm.setTimezone(request.timezone());
    }
    if (request.currency() != null && !request.currency().isBlank()) {
      farm.setCurrency(request.currency());
    }
    farm.setCreatedBy(creatorUserId);
    Farm saved = farmRepository.save(farm);

    UserFarm owner = new UserFarm();
    owner.setUserId(creatorUserId);
    owner.setFarmId(saved.getId());
    owner.setRole(FarmRole.OWNER);
    owner.setPermissions(FarmRole.OWNER.defaultPermissions());
    userFarmRepository.save(owner);

    return tenancyMapper.toResponse(saved);
  }

  @Transactional(readOnly = true)
  public List<FarmResponse> listAccessible(Long userId, boolean isAdmin) {
    List<Farm> farms;
    if (isAdmin) {
      farms = farmRepository.findAll();
    } else {
      List<Long> farmIds =
          userFarmRepository.findByUserIdAndIsActiveTrue(userId).stream()
              .map(UserFarm::getFarmId)
              .toList();
      farms = farmRepository.findAllById(farmIds);
    }
    return farms.stream().map(tenancyMapper::toResponse).toList();
  }

  @Transactional(readOnly = true)
  public FarmResponse get(Long farmId) {
    return tenancyMapper.toResponse(load(farmId));
  }

  @Transactional
  public FarmResponse update(Long farmId, UpdateFarmRequest request) {
    Farm farm = load(farmId);
    farm.setName(request.name());
    farm.setDescription(request.description());
    farm.setLocation(request.location());
    farm.setGpsLatitude(request.gpsLatitude());
    farm.setGpsLongitude(request.gpsLongitude());
    farm.setCapacity(request.capacity());
    if (request.timezone() != null && !request.timezone().isBlank()) {
      farm.setTimezone(request.timezone());
    }
    if (request.currency() != null && !request.currency().isBlank()) {
      farm.setCurrency(request.currency());
    }
    return tenancyMapper.toResponse(farm);
  }

  /** Soft delete: {@code @SQLDelete} on {@link Farm} turns this into {@code SET deleted_at}. */
  @Transactional
  public void delete(Long farmId) {
    farmRepository.delete(load(farmId));
  }

  private Farm load(Long farmId) {
    return farmRepository.findById(farmId).orElseThrow(() -> NotFoundException.of("Farm", farmId));
  }
}
