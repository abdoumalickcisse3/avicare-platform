package com.avicare.livestock.dto.request;

import com.avicare.livestock.domain.BreedProfile;
import com.avicare.livestock.domain.Species;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Body of {@code POST /api/v1/farms/{farmId}/breeds}: a farmer (or platform staff) declaring a
 * breed the catalogue does not have (Goliath, Kuroiler, "locale améliorée"...). {@code species}
 * defaults to {@code POULTRY} — V1 ships poultry only (doc 00 Décision 1/5), so every caller of
 * this endpoint omits it.
 */
public record DeclareBreedRequest(
    @NotBlank String name, @NotNull BreedProfile profile, Species species) {

  public DeclareBreedRequest {
    if (species == null) {
      species = Species.POULTRY;
    }
  }
}
