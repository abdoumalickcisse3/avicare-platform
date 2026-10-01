package com.avicare.notification.push;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Repository for push devices. */
public interface PushDeviceRepository extends JpaRepository<PushDevice, Long> {

  /**
   * Insert the device or take an existing token over, in one statement: two concurrent
   * registrations of the same token (a double-tap, two app launches) would otherwise both see "no
   * row" and the second insert would hit the unique constraint.
   */
  @Modifying
  @Query(
      value =
          "INSERT INTO push_devices (user_id, token, platform, last_seen_at, revoked_at)"
              + " VALUES (:userId, :token, :platform, NOW(), NULL)"
              + " ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id,"
              + " platform = EXCLUDED.platform, last_seen_at = NOW(), revoked_at = NULL",
      nativeQuery = true)
  void upsert(
      @Param("userId") Long userId,
      @Param("token") String token,
      @Param("platform") String platform);

  Optional<PushDevice> findByToken(String token);

  List<PushDevice> findByTokenIn(Collection<String> tokens);

  List<PushDevice> findByUserIdInAndRevokedAtIsNull(Collection<Long> userIds);
}
