package com.avicare.livestock.service;

import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.Breed;
import com.avicare.livestock.domain.BreedProfile;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.repository.BreedRepository;
import java.util.Collection;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lets a farmer (or, via the same method, platform staff — Tâche 8) declare a breed the catalogue
 * does not have (Goliath, Kuroiler, "locale améliorée"...). {@code farmId == null} declares a
 * PLATFORM breed, visible to every farm; a non-null {@code farmId} declares a breed custom to that
 * farm only.
 *
 * <p>No {@code ParametersFacade} dependency here on purpose: a facade dependency inside a service
 * that {@code @DataJpaTest} slices {@code @Import} breaks the slice (green locally, red in CI
 * Testcontainers) — see project memory.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class BreedWriteService {

  private final BreedRepository breedRepository;

  /**
   * Returns the existing breed if one already matches {@code (species, code, profile)} in the
   * caller's visible set (platform first, then the declaring farm's own custom breeds — never
   * another farm's), otherwise creates one.
   */
  public Breed declare(Long farmId, Species species, String name, BreedProfile profile) {
    String code = BreedCodes.slugify(name);
    if (code.isEmpty()) {
      throw new ValidationException(
          "BREED_NAME_EMPTY", "Breed name slugifies to an empty code: " + name);
    }

    Collection<Long> farmIds = farmId == null ? List.of() : List.of(farmId);
    List<Breed> existing =
        breedRepository.findVisibleByCodeAndProfile(species, code, profile, farmIds);
    if (!existing.isEmpty()) {
      return existing.get(0);
    }

    Breed breed = new Breed();
    breed.setSpecies(species);
    breed.setCode(code);
    breed.setName(name);
    breed.setType(profile.type());
    breed.setProfile(profile);
    breed.setFarmId(farmId);
    breed.setActive(true);
    return breedRepository.save(breed);
  }
}
