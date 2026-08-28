package com.avicare.identity.repository;

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
}
