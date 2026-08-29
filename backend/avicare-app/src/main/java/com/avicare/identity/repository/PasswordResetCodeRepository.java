package com.avicare.identity.repository;

import com.avicare.identity.domain.PasswordResetCode;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for {@link PasswordResetCode}. */
public interface PasswordResetCodeRepository extends JpaRepository<PasswordResetCode, Long> {

  Optional<PasswordResetCode> findFirstByUserIdOrderByCreatedAtDesc(Long userId);
}
