package com.avicare.livestock.repository;

import com.avicare.livestock.domain.VaccinationProgramLot;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VaccinationProgramLotRepository
    extends JpaRepository<VaccinationProgramLot, Long> {

  Optional<VaccinationProgramLot> findByProductionUnitId(Long productionUnitId);
}
