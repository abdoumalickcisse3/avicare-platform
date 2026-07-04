package com.avicare.finance.repository;

import com.avicare.finance.domain.Salary;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SalaryRepository extends JpaRepository<Salary, Long> {

  boolean existsByFarmIdAndUserIdAndPeriod(Long farmId, Long userId, String period);

  List<Salary> findByFarmIdAndPeriodOrderByUserId(Long farmId, String period);

  List<Salary> findByFarmIdOrderByPeriodDescUserIdAsc(Long farmId);
}
