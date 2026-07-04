package com.avicare.finance.repository;

import com.avicare.finance.domain.AdvanceStatus;
import com.avicare.finance.domain.SalaryAdvance;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SalaryAdvanceRepository extends JpaRepository<SalaryAdvance, Long> {

  List<SalaryAdvance> findByFarmIdOrderByRequestedAtDesc(Long farmId);

  List<SalaryAdvance> findByFarmIdAndStatusOrderByRequestedAtDesc(
      Long farmId, AdvanceStatus status);

  List<SalaryAdvance> findByFarmIdAndUserIdOrderByRequestedAtDesc(Long farmId, Long userId);

  List<SalaryAdvance>
      findByFarmIdAndUserIdAndStatusAndRemainingXofGreaterThanOrderByDecidedAtAscIdAsc(
          Long farmId, Long userId, AdvanceStatus status, Long remaining);
}
