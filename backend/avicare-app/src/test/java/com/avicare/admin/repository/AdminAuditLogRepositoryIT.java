package com.avicare.admin.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.avicare.admin.domain.AdminAuditLog;
import jakarta.persistence.EntityManager;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * The whole point of this table is that nobody can rewrite it. These tests prove the guarantee is
 * enforced by PostgreSQL and not merely by the absence of setters in Java — a trail a database
 * connection can edit is not a trail. CI-only: Testcontainers cannot run on the dev machine.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class AdminAuditLogRepositoryIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource
  static void datasource(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.enabled", () -> "true");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
  }

  @Autowired AdminAuditLogRepository repository;
  @Autowired EntityManager em;

  private AdminAuditLog persistEntry() {
    AdminAuditLog entry =
        new AdminAuditLog(
            42L, "farm.module.enable", "Farm", 8L, 8L, Map.of("module", "poultry"), "10.0.0.1");
    return repository.saveAndFlush(entry);
  }

  @Test
  void storesAnEntryWithItsJsonMetadataAndDbOwnedTimestamp() {
    AdminAuditLog saved = persistEntry();

    assertThat(saved.getId()).isNotNull();
    assertThat(saved.getMetadata()).containsEntry("module", "poultry");
    em.refresh(saved);
    assertThat(saved.getCreatedAt()).isNotNull();
  }

  @Test
  void refusesAnUpdate() {
    Long id = persistEntry().getId();
    em.clear();

    assertThatThrownBy(
            () -> {
              em.createNativeQuery("UPDATE admin_audit_log SET action = 'tampered' WHERE id = :id")
                  .setParameter("id", id)
                  .executeUpdate();
              em.flush();
            })
        .hasMessageContaining("append-only");
  }

  @Test
  void refusesADelete() {
    Long id = persistEntry().getId();
    em.clear();

    assertThatThrownBy(
            () -> {
              em.createNativeQuery("DELETE FROM admin_audit_log WHERE id = :id")
                  .setParameter("id", id)
                  .executeUpdate();
              em.flush();
            })
        .hasMessageContaining("append-only");
  }
}
