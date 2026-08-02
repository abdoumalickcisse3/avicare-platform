package com.avicare.identity.repository;

import com.avicare.identity.domain.RefreshToken;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Data access for {@link RefreshToken}. Lookups use the SHA-256 hash stored in {@code token}. */
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

  Optional<RefreshToken> findByToken(String token);

  List<RefreshToken> findByUserIdAndRevokedAtIsNull(Long userId);

  /** Hard-delete rows past their expiry (housekeeping — see {@code RefreshTokenService#purge}). */
  @Modifying
  @Query("DELETE FROM RefreshToken t WHERE t.expiresAt < :cutoff")
  int deleteExpiredBefore(@Param("cutoff") LocalDateTime cutoff);
}
