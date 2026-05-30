package com.avicare.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.common.security.principal.FarmRole;
import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.identity.repository.UserRepository;
import com.avicare.tenancy.domain.Farm;
import com.avicare.tenancy.domain.UserFarm;
import com.avicare.tenancy.repository.FarmRepository;
import com.avicare.tenancy.repository.UserFarmRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Proves the V1 Flyway migration runs on a clean PostgreSQL and that the identity/tenancy JPA
 * mappings agree with the resulting schema. Hibernate runs with {@code ddl-auto=validate}, so a
 * mismatch between an entity and a migrated column fails the context. The round-trip then checks the
 * trigger-owned timestamps, the JSONB permissions column, the {@link FarmRole}/{@link UserRole}
 * string enums, and the {@code @SQLRestriction} soft-delete filter.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class IdentityTenancyMappingTest {

  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource
  static void datasource(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.enabled", () -> "true");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
  }

  @Autowired private TestEntityManager entityManager;
  @Autowired private UserRepository userRepository;
  @Autowired private FarmRepository farmRepository;
  @Autowired private UserFarmRepository userFarmRepository;

  @Test
  void schemaValidatesAndEntitiesRoundTrip() {
    User user = newUser("owner@example.com");
    user = userRepository.saveAndFlush(user);

    Farm farm = newFarm(user.getId());
    farm = farmRepository.saveAndFlush(farm);

    UserFarm membership = new UserFarm();
    membership.setUserId(user.getId());
    membership.setFarmId(farm.getId());
    membership.setRole(FarmRole.OWNER);
    membership.setPermissions(FarmRole.OWNER.defaultPermissions());
    membership = userFarmRepository.saveAndFlush(membership);

    entityManager.clear();

    assertThat(userRepository.findByEmailIgnoreCase("OWNER@example.com")).isPresent();

    Farm reloaded = farmRepository.findById(farm.getId()).orElseThrow();
    assertThat(reloaded.getCurrency()).isEqualTo("XOF");
    assertThat(reloaded.getTimezone()).isEqualTo("Africa/Dakar");
    // DB-owned timestamps are populated by DEFAULT NOW() / trigger and read back on reload.
    assertThat(reloaded.getCreatedAt()).isNotNull();
    assertThat(reloaded.getUpdatedAt()).isNotNull();

    UserFarm reloadedMembership =
        userFarmRepository.findByUserIdAndFarmId(user.getId(), farm.getId()).orElseThrow();
    assertThat(reloadedMembership.getRole()).isEqualTo(FarmRole.OWNER);
    assertThat(reloadedMembership.getPermissions()).containsExactly("*");
    assertThat(userFarmRepository.findByUserId(user.getId())).hasSize(1);
  }

  @Test
  void softDeletedFarmIsHiddenFromReads() {
    User user = userRepository.saveAndFlush(newUser("soft@example.com"));
    Farm farm = farmRepository.saveAndFlush(newFarm(user.getId()));
    Long farmId = farm.getId();

    farmRepository.delete(farm);
    farmRepository.flush();
    entityManager.clear();

    // @SQLDelete set deleted_at; @SQLRestriction("deleted_at IS NULL") now hides the row.
    assertThat(farmRepository.findById(farmId)).isEmpty();
  }

  private static User newUser(String email) {
    User user = new User();
    user.setEmail(email);
    user.setPasswordHash("$2a$12$abcdefghijklmnopqrstuv");
    user.setFullName("Awa Diop");
    user.setRole(UserRole.USER);
    return user;
  }

  private static Farm newFarm(Long createdBy) {
    Farm farm = new Farm();
    farm.setName("Ferme Keur Massar");
    farm.setCreatedBy(createdBy);
    return farm;
  }
}
