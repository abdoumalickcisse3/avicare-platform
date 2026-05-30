package com.avicare.identity.repository;

import com.avicare.identity.domain.User;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for {@link User}. Email lookups are case-insensitive (emails are unique). */
public interface UserRepository extends JpaRepository<User, Long> {

  Optional<User> findByEmailIgnoreCase(String email);

  boolean existsByEmailIgnoreCase(String email);
}
