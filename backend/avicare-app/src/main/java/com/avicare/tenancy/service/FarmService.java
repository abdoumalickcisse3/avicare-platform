package com.avicare.tenancy.service;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.common.security.principal.FarmRole;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.subscription.api.SubscriptionFacade;
import com.avicare.tenancy.domain.Farm;
import com.avicare.tenancy.domain.UserFarm;
import com.avicare.tenancy.dto.request.CreateFarmRequest;
import com.avicare.tenancy.dto.request.UpdateFarmRequest;
import com.avicare.tenancy.dto.response.FarmResponse;
import com.avicare.tenancy.mapper.TenancyMapper;
import com.avicare.tenancy.repository.FarmLogoRepository;
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

  /** Catalogue des pays, semé par V67 : fuseau et libellé du champ fiscal par code ISO. */
  static final String COUNTRIES_CATEGORY = "countries";

  static final String DEFAULT_COUNTRY = "SN";
  static final String DEFAULT_TIMEZONE = "Africa/Dakar";
  static final String DEFAULT_TAX_ID_LABEL = "NINEA";
  static final Set<String> ALLOWED_FOCUS = Set.of("broiler", "layer");

  private final FarmRepository farmRepository;
  private final FarmLogoRepository farmLogoRepository;
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
    String pays = blankTo(request.country(), DEFAULT_COUNTRY);
    farm.setCountry(pays);
    // Le fuseau suit le pays, sauf si l'appelant en impose un : l'explicite gagne toujours sur le
    // déduit. Sans cette ligne, le défaut posé en Java sur l'entité ferait rester toute ferme à
    // l'heure de Dakar — y compris une ferme ivoirienne.
    farm.setTimezone(
        request.timezone() != null && !request.timezone().isBlank()
            ? request.timezone()
            : countryDefaults(pays).timezone());
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
    // Ce PUT remplace les champs omis — c'est écrit pour `ninea`. Le pays, lui, est NOT NULL :
    // un client qui ne connaît pas encore ce champ ramènerait toutes les fermes au Sénégal.
    // Absent vaut donc « inchangé », et le fuseau déjà choisi n'est pas réécrit derrière.
    if (request.country() != null && !request.country().isBlank()) {
      farm.setCountry(request.country());
    }
    if (request.timezone() != null && !request.timezone().isBlank()) {
      farm.setTimezone(request.timezone());
    }
    if (request.currency() != null && !request.currency().isBlank()) {
      farm.setCurrency(request.currency());
    }
    farm.setNinea(request.ninea());
    farm.setRccm(request.rccm());
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
  /**
   * Ce qu'un pays décide, lu dans le catalogue.
   *
   * <p>Un code absent du catalogue n'est pas une erreur : le sélecteur de téléphone connaît seize
   * pays quand la zone XOF en compte huit, et un éleveur ivoirien peut très bien porter un numéro
   * français. On retombe alors sur les défauts plutôt que de refuser la création de sa ferme.
   */
  private CountryDefaults countryDefaults(String iso) {
    Map<String, Object> value =
        parametersFacade.resolve(null, null, COUNTRIES_CATEGORY, iso).orElse(Map.of());
    return new CountryDefaults(
        text(value.get("timezone"), DEFAULT_TIMEZONE),
        text(value.get("tax_id_label"), DEFAULT_TAX_ID_LABEL));
  }

  private record CountryDefaults(String timezone, String taxIdLabel) {}

  private static String text(Object value, String fallback) {
    return value instanceof String s && !s.isBlank() ? s : fallback;
  }

  private static String blankTo(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value;
  }

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
        readFocus(farm.getId()),
        farm.getNinea(),
        farm.getRccm(),
        // L'horodatage seul, jamais les octets : voir FarmResponse.
        farmLogoRepository.findUpdatedAt(farm.getId()).orElse(null),
        farm.getCountry(),
        countryDefaults(farm.getCountry()).taxIdLabel());
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
        throw new ValidationException(
            "INVALID_PRODUCTION_FOCUS", "Unknown production focus '" + token + "'");
      }
    }
    parametersFacade.setFarmSetting(farmId, FOCUS_KEY, Map.of("value", List.copyOf(focus)));
  }
}
