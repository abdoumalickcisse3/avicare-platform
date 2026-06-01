package com.avicare.parameters.repository;

import com.avicare.parameters.domain.UserSetting;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for {@link UserSetting} (layer 3 of the 3-layer lookup). */
public interface UserSettingRepository extends JpaRepository<UserSetting, Long> {

  Optional<UserSetting> findByUserIdAndKey(Long userId, String key);

  List<UserSetting> findByUserId(Long userId);
}
