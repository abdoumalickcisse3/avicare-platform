package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.livestock.domain.Breed;
import com.avicare.livestock.dto.request.DeclareBreedRequest;
import com.avicare.livestock.dto.response.BreedResponse;
import com.avicare.livestock.service.BreedProfileDefaults;
import com.avicare.livestock.service.BreedWriteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lets a farm declare a breed the catalogue does not have (Goliath, Kuroiler, "locale
 * améliorée"...) — a separate class from {@link BreedController} because a class-level
 * {@code @RequestMapping} carries one path, and {@code BreedController} already owns the farm-less
 * {@code GET /api/v1/breeds}.
 *
 * <p>Restricted to OWNER/MANAGER, like every other farm-settings write in this repo.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/breeds")
@RequiredArgsConstructor
public class FarmBreedController {

  private final BreedWriteService breedWriteService;
  private final BreedProfileDefaults breedProfileDefaults;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public ApiResponse<BreedResponse> declare(
      @PathVariable Long farmId, @RequestBody @Valid DeclareBreedRequest request) {
    Breed breed =
        breedWriteService.declare(farmId, request.species(), request.name(), request.profile());
    return ApiResponse.of(BreedResponse.of(breed, breedProfileDefaults));
  }
}
