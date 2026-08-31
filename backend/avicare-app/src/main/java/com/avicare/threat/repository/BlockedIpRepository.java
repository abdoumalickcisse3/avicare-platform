package com.avicare.threat.repository;

import com.avicare.threat.domain.BlockedIp;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** Currently refused addresses. Read on the hot path, so kept trivial. */
public interface BlockedIpRepository extends JpaRepository<BlockedIp, String> {

  List<BlockedIp> findByBlockedUntilAfterOrderByBlockedAtDesc(LocalDateTime now);
}
