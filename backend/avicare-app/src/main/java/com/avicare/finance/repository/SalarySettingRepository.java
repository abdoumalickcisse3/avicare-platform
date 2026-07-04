package com.avicare.finance.repository;

import com.avicare.finance.domain.SalarySetting;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SalarySettingRepository extends JpaRepository<SalarySetting, Long> {

  Optional<SalarySetting> findByFarmIdAndUserId(Long farmId, Long userId);

  List<SalarySetting> findByFarmIdOrderByUserId(Long farmId);

  List<SalarySetting> findByFarmIdAndActiveTrueOrderByUserId(Long farmId);
}
