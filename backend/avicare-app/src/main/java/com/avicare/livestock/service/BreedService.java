package com.avicare.livestock.service;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.domain.Breed;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.repository.BreedRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read access to the breed reference (platform + farm-custom breeds). */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BreedService {

  private final BreedRepository breedRepository;

  public List<Breed> listBySpecies(Species species, boolean activeOnly) {
    return activeOnly
        ? breedRepository.findBySpeciesAndActiveTrue(species)
        : breedRepository.findBySpecies(species);
  }

  public Breed get(Long id) {
    return breedRepository.findById(id).orElseThrow(() -> NotFoundException.of("Breed", id));
  }
}
