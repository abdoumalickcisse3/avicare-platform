package com.avicare.livestock.dto.response;

import com.avicare.livestock.domain.Breed;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.service.BreedProfileDefaults;

/**
 * HTTP view of a breed reference entry. {@code type} is broiler|layer for poultry (may be null).
 *
 * <p>{@code profile}, {@code defaultTargetWeightG} and {@code defaultTargetAgeDays} travel here —
 * not via a separate catalog endpoint — because the field worker ({@code FARMER}) has {@code
 * poultry:write} and creates batches, but not {@code settings:read}: a call to {@code
 * /farms/{id}/catalog/breed_profiles} from his own batch form would 403.
 */
public record BreedResponse(
    Long id,
    Species species,
    String code,
    String name,
    String type,
    String profile,
    Integer defaultTargetWeightG,
    Integer defaultTargetAgeDays,
    Long farmId,
    boolean active) {

  /** Composes a breed with its profile's resolved default targets. */
  public static BreedResponse of(Breed breed, BreedProfileDefaults breedProfileDefaults) {
    BreedProfileDefaults.Targets targets =
        breedProfileDefaults.targetsFor(breed.getProfile()).orElse(null);
    return new BreedResponse(
        breed.getId(),
        breed.getSpecies(),
        breed.getCode(),
        breed.getName(),
        breed.getType(),
        breed.getProfile() == null ? null : breed.getProfile().name(),
        targets == null ? null : targets.weightG(),
        targets == null ? null : targets.ageDays(),
        breed.getFarmId(),
        breed.isActive());
  }
}
