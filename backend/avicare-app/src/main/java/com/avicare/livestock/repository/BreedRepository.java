package com.avicare.livestock.repository;

import com.avicare.livestock.domain.Breed;
import com.avicare.livestock.domain.Species;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Data access for {@link Breed}. */
public interface BreedRepository extends JpaRepository<Breed, Long> {

  List<Breed> findBySpecies(Species species);

  List<Breed> findBySpeciesAndActiveTrue(Species species);

  @Query(
      "select b from Breed b where b.species = :species and (b.farmId is null or b.farmId in :farmIds)"
          + " and (:activeOnly = false or b.active = true)")
  List<Breed> findVisible(
      @Param("species") Species species,
      @Param("farmIds") Collection<Long> farmIds,
      @Param("activeOnly") boolean activeOnly);

  Optional<Breed> findBySpeciesAndCodeAndFarmId(Species species, String code, Long farmId);
}
