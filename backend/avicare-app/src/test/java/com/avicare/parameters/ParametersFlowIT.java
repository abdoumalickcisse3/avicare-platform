package com.avicare.parameters;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.parameters.domain.CatalogItem;
import com.avicare.parameters.repository.CatalogItemRepository;
import com.avicare.parameters.service.CatalogEntry;
import com.avicare.parameters.service.CatalogService;
import com.avicare.parameters.service.FarmSettingService;
import com.avicare.tenancy.domain.Farm;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * End-to-end parametrization flow on a real PostgreSQL (Testcontainers): seeds a catalog item, a
 * farm override and a user setting, then checks the 3-layer lookup precedence and the catalog merge
 * (override visible, platform addition listed). CI-only on dev machines (Docker incompatibility).
 */
@SpringBootTest
@Testcontainers
@Transactional
class ParametersFlowIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.enabled", () -> "true");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    // The default 'dev' profile carries dev JWT keys; no web layer is exercised here.
    registry.add("spring.data.redis.repositories.enabled", () -> "false");
  }

  @Autowired private FarmSettingService farmSettingService;
  @Autowired private CatalogService catalogService;
  @Autowired private CatalogItemRepository catalogItemRepository;
  @Autowired private jakarta.persistence.EntityManager em;

  private long seedUser() {
    User u = new User();
    u.setEmail("p@example.com");
    u.setPasswordHash("$2a$12$abcdefghijklmnopqrstuv");
    u.setFullName("P");
    u.setRole(UserRole.USER);
    em.persist(u);
    return u.getId();
  }

  private long seedFarm(long userId) {
    Farm f = new Farm();
    f.setName("Ferme P");
    f.setCreatedBy(userId);
    em.persist(f);
    return f.getId();
  }

  @Test
  void threeLayerLookup_respectsPrecedence() {
    long userId = seedUser();
    long farmId = seedFarm(userId);

    CatalogItem catalog = new CatalogItem();
    catalog.setCategory("settings");
    catalog.setKey("default_breed");
    catalog.setValue(Map.of("value", "catalog"));
    catalogItemRepository.save(catalog);
    em.flush();

    // Only catalog defines it -> catalog wins.
    assertThat(farmSettingService.resolve(userId, farmId, "settings", "default_breed"))
        .contains(Map.of("value", "catalog"));

    // Farm override -> farm wins over catalog.
    farmSettingService.setFarmSetting(farmId, "default_breed", Map.of("value", "farm"));
    em.flush();
    assertThat(farmSettingService.resolve(userId, farmId, "settings", "default_breed"))
        .contains(Map.of("value", "farm"));

    // User preference -> user wins over farm.
    farmSettingService.setUserSetting(userId, "default_breed", Map.of("value", "user"));
    em.flush();
    assertThat(farmSettingService.resolve(userId, farmId, "settings", "default_breed"))
        .contains(Map.of("value", "user"));
  }

  @Test
  void catalogMerge_overrideAndCustomAddition() {
    long userId = seedUser();
    long farmId = seedFarm(userId);

    CatalogItem cobb = new CatalogItem();
    cobb.setCategory("breeds");
    cobb.setKey("cobb_500");
    cobb.setValue(Map.of("label", "Cobb 500"));
    catalogItemRepository.save(cobb);
    em.flush();

    catalogService.override(farmId, "breeds", "cobb_500", Map.of("label", "Mes Cobb 500"));
    catalogService.override(farmId, "breeds", "local", Map.of("label", "Ma souche locale"));
    em.flush();

    List<CatalogEntry> entries = catalogService.listForFarm(farmId, "breeds");
    assertThat(entries).hasSize(2);
    assertThat(entries)
        .anySatisfy(e -> assertThat(e.value()).containsEntry("label", "Mes Cobb 500"))
        .anySatisfy(
            e -> {
              assertThat(e.key()).isEqualTo("local");
              assertThat(e.custom()).isTrue();
            });
  }
}
