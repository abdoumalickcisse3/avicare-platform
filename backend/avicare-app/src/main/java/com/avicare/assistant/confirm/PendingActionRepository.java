package com.avicare.assistant.confirm;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Store of ephemeral server-side confirm claims (V32). */
public interface PendingActionRepository extends JpaRepository<PendingAction, Long> {

  Optional<PendingAction> findByClaimId(String claimId);

  /** Claims whose TTL has elapsed — swept by the scheduled cleanup. */
  List<PendingAction> findByExpiresAtBefore(LocalDateTime cutoff);
}
