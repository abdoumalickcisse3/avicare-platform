package com.avicare.livestock.repository;

import com.avicare.livestock.domain.Breed;
import com.avicare.livestock.domain.Species;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for {@link Breed}. */
public interface BreedRepository extends JpaRepository<Breed, Long> {

  List<Breed> findBySpecies(Species species);

  List<Breed> findBySpeciesAndActiveTrue(Species species);

  Optional<Breed> findBySpeciesAndCodeAndFarmId(Species species, String code, Long farmId);
}
