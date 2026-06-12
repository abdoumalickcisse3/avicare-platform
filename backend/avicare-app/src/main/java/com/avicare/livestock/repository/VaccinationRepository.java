package com.avicare.livestock.repository;

import com.avicare.livestock.domain.Vaccination;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VaccinationRepository extends JpaRepository<Vaccination, Long> {

  List<Vaccination> findByProductionUnitIdOrderByAdministeredDateDesc(Long productionUnitId);

  List<Vaccination> findByProductionUnitIdAndVaccineKey(Long productionUnitId, String vaccineKey);

  Optional<Vaccination> findByProductionUnitIdAndVaccineKeyAndAdministeredDate(
      Long productionUnitId, String vaccineKey, LocalDate administeredDate);

  List<Vaccination> findByProductionUnitIdAndAdministeredDateBetween(
      Long productionUnitId, LocalDate from, LocalDate to);

  long countByProductionUnitId(Long productionUnitId);
}
