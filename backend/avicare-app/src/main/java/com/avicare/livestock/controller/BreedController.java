package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.livestock.domain.Breed;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.dto.response.BreedResponse;
import com.avicare.livestock.service.BreedService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read access to the breed reference. Any authenticated user can browse breeds for a species; the
 * list has no farm in its path, so it is narrowed to the platform breeds plus the custom breeds of
 * the caller's own farms.
 */
@RestController
@RequestMapping("/api/v1/breeds")
@RequiredArgsConstructor
public class BreedController {

  private final BreedService breedService;

  @GetMapping
  public ApiResponse<List<BreedResponse>> list(
      @RequestParam Species species,
      @RequestParam(defaultValue = "true") boolean activeOnly,
      Authentication auth) {
    List<Breed> breeds =
        auth != null && auth.getDetails() instanceof AvicarePrincipal principal
            ? (principal.isAdmin()
                ? breedService.listAll(species, activeOnly)
                : breedService.listVisible(species, activeOnly, principal.accessibleFarmIds()))
            : breedService.listVisible(species, activeOnly, List.of());
    return ApiResponse.of(breeds.stream().map(BreedController::toResponse).toList());
  }

  private static BreedResponse toResponse(Breed b) {
    return new BreedResponse(
        b.getId(),
        b.getSpecies(),
        b.getCode(),
        b.getName(),
        b.getType(),
        b.getFarmId(),
        b.isActive());
  }
}
