package com.avicare.tenancy.service;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.security.principal.FarmRole;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.subscription.api.SubscriptionFacade;
import com.avicare.tenancy.domain.Farm;
import com.avicare.tenancy.domain.UserFarm;
import com.avicare.tenancy.dto.request.CreateFarmRequest;
import com.avicare.tenancy.dto.request.UpdateFarmRequest;
import com.avicare.tenancy.dto.response.FarmResponse;
import com.avicare.tenancy.mapper.TenancyMapper;
import com.avicare.tenancy.repository.FarmRepository;
import com.avicare.tenancy.repository.UserFarmRepository;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
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

  /** farm_settings key + allowed métier focus tokens (V1), Décision 17. */
  static final String FOCUS_CATEGORY = "farm";

  static final String FOCUS_KEY = "production_focus";
  static final Set<String> ALLOWED_FOCUS = Set.of("broiler", "layer");

  private final FarmRepository farmRepository;
  private final UserFarmRepository userFarmRepository;
  private final TenancyMapper tenancyMapper;
  private final ParametersFacade parametersFacade;
  private final SubscriptionFacade subscriptionFacade;

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

    // Free-pilot (ADR-009): give the new farm every V1 module up front, so module-gated
    // features (élevage, stock, commercial…) work immediately without any subscription step.
    subscriptionFacade.provisionModules(saved.getId());

    if (request.productionFocus() != null) {
      writeFocus(saved.getId(), request.productionFocus());
    }
    return respond(saved);
  }

  @Transactional(readOnly = true)
  public List<FarmResponse> listAccessible(Long userId, boolean isAdmin) {
    List<Farm> farms;
    if (isAdmin) {
      farms = farmRepository.findAll();
    } else {
      List<Long> farmIds =
          userFarmRepository.findByUserIdAndActiveTrue(userId).stream()
              .map(UserFarm::getFarmId)
              .toList();
      farms = farmRepository.findAllById(farmIds);
    }
    return farms.stream().map(this::respond).toList();
  }

  @Transactional(readOnly = true)
  public FarmResponse get(Long farmId) {
    return respond(load(farmId));
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
    if (request.productionFocus() != null) {
      writeFocus(farmId, request.productionFocus());
    }
    return respond(farm);
  }

  /** Soft delete: {@code @SQLDelete} on {@link Farm} turns this into {@code SET deleted_at}. */
  @Transactional
  public void delete(Long farmId) {
    farmRepository.delete(load(farmId));
  }

  private Farm load(Long farmId) {
    return farmRepository.findById(farmId).orElseThrow(() -> NotFoundException.of("Farm", farmId));
  }

  /** Map a farm to its response, enriched with its production focus (Décision 17). */
  private FarmResponse respond(Farm farm) {
    FarmResponse b = tenancyMapper.toResponse(farm);
    return new FarmResponse(
        b.id(),
        b.name(),
        b.description(),
        b.location(),
        b.gpsLatitude(),
        b.gpsLongitude(),
        b.capacity(),
        b.timezone(),
        b.currency(),
        b.createdBy(),
        b.active(),
        b.createdAt(),
        readFocus(farm.getId()));
  }

  @SuppressWarnings("unchecked")
  private List<String> readFocus(Long farmId) {
    return parametersFacade
        .resolve(null, farmId, FOCUS_CATEGORY, FOCUS_KEY)
        .map(v -> (List<String>) v.get("value"))
        .filter(Objects::nonNull)
        .orElseGet(List::of);
  }

  /** Validate the focus tokens (⊆ broiler/layer) and upsert them on the farm (layer 2). */
  private void writeFocus(Long farmId, List<String> focus) {
    for (String token : focus) {
      if (!ALLOWED_FOCUS.contains(token)) {
        throw new BusinessRuleException(
            "INVALID_PRODUCTION_FOCUS", "Unknown production focus '" + token + "'");
      }
    }
    parametersFacade.setFarmSetting(farmId, FOCUS_KEY, Map.of("value", List.copyOf(focus)));
  }
}
