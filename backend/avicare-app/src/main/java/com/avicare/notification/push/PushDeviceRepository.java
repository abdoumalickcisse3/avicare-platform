package com.avicare.notification.push;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for push devices. */
public interface PushDeviceRepository extends JpaRepository<PushDevice, Long> {

  Optional<PushDevice> findByToken(String token);

  List<PushDevice> findByTokenIn(Collection<String> tokens);

  List<PushDevice> findByUserIdInAndRevokedAtIsNull(Collection<Long> userIds);
}
