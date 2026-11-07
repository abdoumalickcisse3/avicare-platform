package com.avicare.livestock.service;

import com.avicare.livestock.domain.BreedProfile;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Resolves the default targets (weight, age) carried by a {@link BreedProfile}, from the platform
 * catalog {@code breed_profiles} (V69). The two layer profiles ({@code LAYER_INDUSTRIAL}, {@code
 * LAYER_RUSTIC}) deliberately carry no targets — laying is tracked by egg rate, not weight/age — so
 * {@link #targetsFor} answers {@code Optional.empty()} for them.
 *
 * <p>Deliberately the ONLY place in the livestock context that reads {@code ParametersFacade}:
 * injecting it into {@code BreedService} or {@code BreedWriteService} instead would pull a
 * cross-context facade dependency into a service that {@code @DataJpaTest} slices {@code @Import} —
 * breaks that slice (green locally, red in CI Testcontainers; see project memory).
 */
@Service
@RequiredArgsConstructor
public class BreedProfileDefaults {

  private static final String CATEGORY = "breed_profiles";

  private final ParametersFacade parametersFacade;

  /** {@code Optional.empty()} when {@code profile} is {@code null} or carries no target. */
  public Optional<Targets> targetsFor(BreedProfile profile) {
    if (profile == null) {
      return Optional.empty();
    }
    String key = profile.name().toLowerCase(Locale.ROOT);
    Map<String, Object> value =
        parametersFacade.listPlatform(CATEGORY).stream()
            .filter(entry -> key.equals(entry.key()))
            .findFirst()
            .map(CatalogEntryInfo::value)
            .orElse(Map.of());

    Integer weightG = asInteger(value.get("default_target_weight_g"));
    Integer ageDays = asInteger(value.get("default_target_age_days"));
    if (weightG == null && ageDays == null) {
      return Optional.empty();
    }
    return Optional.of(new Targets(weightG, ageDays));
  }

  private static Integer asInteger(Object raw) {
    if (raw == null) {
      return null;
    }
    if (raw instanceof Number number) {
      return number.intValue();
    }
    return Integer.parseInt(raw.toString());
  }

  /** Default target weight (grams) and/or age (days) for a breed profile. */
  public record Targets(Integer weightG, Integer ageDays) {}
}
