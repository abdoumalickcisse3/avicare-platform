package com.avicare.livestock.repository;

import com.avicare.livestock.domain.Veterinarian;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VeterinarianRepository extends JpaRepository<Veterinarian, Long> {

  List<Veterinarian> findByFarmIdAndActiveTrueOrderByFullName(Long farmId);

  Optional<Veterinarian> findByFarmIdAndId(Long farmId, Long id);
}
