package com.avicare.identity.repository;

import com.avicare.identity.domain.RefreshToken;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for {@link RefreshToken}. Lookups use the SHA-256 hash stored in {@code token}. */
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

  Optional<RefreshToken> findByToken(String token);

  List<RefreshToken> findByUserIdAndRevokedAtIsNull(Long userId);
}
