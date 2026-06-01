package com.avicare.parameters.repository;

import com.avicare.parameters.domain.FarmSetting;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for {@link FarmSetting} (layer 2 of the 3-layer lookup). */
public interface FarmSettingRepository extends JpaRepository<FarmSetting, Long> {

  Optional<FarmSetting> findByFarmIdAndKey(Long farmId, String key);

  List<FarmSetting> findByFarmId(Long farmId);
}
