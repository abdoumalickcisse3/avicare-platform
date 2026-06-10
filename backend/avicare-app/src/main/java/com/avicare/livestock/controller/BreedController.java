package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.livestock.domain.Breed;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.dto.response.BreedResponse;
import com.avicare.livestock.service.BreedService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read access to the breed reference. Any authenticated user can browse breeds for a species; the
 * list is platform-level (not farm-scoped), so no {@code @farmAccess} guard.
 */
@RestController
@RequestMapping("/api/v1/breeds")
@RequiredArgsConstructor
public class BreedController {

  private final BreedService breedService;

  @GetMapping
  public ApiResponse<List<BreedResponse>> list(
      @RequestParam Species species, @RequestParam(defaultValue = "true") boolean activeOnly) {
    return ApiResponse.of(
        breedService.listBySpecies(species, activeOnly).stream()
            .map(BreedController::toResponse)
            .toList());
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
