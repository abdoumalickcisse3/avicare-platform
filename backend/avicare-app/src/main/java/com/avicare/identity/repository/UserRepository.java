package com.avicare.identity.repository;

import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Data access for {@link User}. Email lookups are case-insensitive (emails are unique). */
public interface UserRepository extends JpaRepository<User, Long> {

  Optional<User> findByEmailIgnoreCase(String email);

  /** Every account carrying a role — used by the console to list platform staff. */
  List<User> findByRole(UserRole role);

  boolean existsByEmailIgnoreCase(String email);

  /**
   * Cross-tenant search on email, name or phone, for platform support. Case-insensitive, and
   * matches anywhere in the field: support is usually given a fragment over the phone, not an exact
   * address.
   */
  @Query(
      "SELECT u FROM User u WHERE LOWER(u.email) LIKE LOWER(CONCAT('%', :q, '%')) "
          + "OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :q, '%')) "
          + "OR u.phone LIKE CONCAT('%', :q, '%') ORDER BY u.id DESC")
  List<User> search(@Param("q") String q, Pageable pageable);

  /**
   * Accounts whose phone, reduced to digits, is one of {@code candidates}.
   *
   * <p>Farmers type their number the way they say it — with spaces, a +221, or neither — while the
   * stored value is E.164 since V63. A single exact comparison therefore found nobody for the short
   * form; {@link com.avicare.identity.service.PhoneLookup} builds the shapes to try.
   */
  @Query(
      value =
          "SELECT * FROM users u WHERE u.phone IS NOT NULL AND btrim(u.phone) <> '' "
              + "AND regexp_replace(u.phone, '[^0-9]', '', 'g') IN (:candidates)",
      nativeQuery = true)
  List<User> findByPhoneDigits(@Param("candidates") java.util.Collection<String> candidates);

  long countByActiveTrue();

  /** Accounts that signed in since a date — the platform's only universal activity signal. */
  long countByLastLoginAtAfter(java.time.LocalDateTime since);
}
