package com.avicare.livestock.repository;

import com.avicare.livestock.domain.FeedFormula;
import com.avicare.livestock.domain.FeedPhase;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FeedFormulaRepository extends JpaRepository<FeedFormula, Long> {

  List<FeedFormula> findByFarmIdAndActiveTrueOrderByName(Long farmId);

  Optional<FeedFormula> findByFarmIdAndIdAndActiveTrue(Long farmId, Long id);

  List<FeedFormula> findByFarmIdAndTargetPhaseAndActiveTrueOrderByName(
      Long farmId, FeedPhase targetPhase);
}
