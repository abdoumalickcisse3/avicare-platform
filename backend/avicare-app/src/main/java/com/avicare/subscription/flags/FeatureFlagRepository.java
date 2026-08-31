package com.avicare.subscription.flags;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Platform flags (console {@code /console/urgence}). */
public interface FeatureFlagRepository extends JpaRepository<FeatureFlag, Long> {

  Optional<FeatureFlag> findByFlagKey(String flagKey);

  List<FeatureFlag> findAllByOrderByFlagKeyAsc();

  /** Cuts whose window has closed — the sweep lifts them. */
  List<FeatureFlag> findByKillswitchActiveTrueAndKillswitchExpiresAtBefore(LocalDateTime cutoff);
}
