package com.avicare.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.parameters.domain.CatalogItem;
import com.avicare.parameters.repository.CatalogItemRepository;
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
 * Verifies the V4 reference-data migration seeded the platform catalog (modules, bundles, breeds,
 * vaccines, expense categories) and that the entries are reachable through the catalog lookup.
 * CI-only on dev machines where Testcontainers can't reach Docker (see project memory).
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class SeedDataIT {

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

  @Autowired private CatalogItemRepository catalogItemRepository;

  @Test
  void catalogCategoriesAreSeededWithExpectedCounts() {
    assertThat(catalogItemRepository.findByCategory("modules")).hasSize(16);
    assertThat(catalogItemRepository.findByCategory("bundles")).hasSize(4);
    assertThat(catalogItemRepository.findByCategory("breeds")).hasSize(5);
    assertThat(catalogItemRepository.findByCategory("vaccines")).hasSize(4);
    assertThat(catalogItemRepository.findByCategory("expense_categories")).hasSize(7);
  }

  @Test
  void breedIsReachableThroughUniversalLookup() {
    CatalogItem cobb =
        catalogItemRepository
            .findByCategoryAndKeyAndLocale("breeds", "cobb_500", null)
            .orElseThrow();
    assertThat(cobb.getValue()).containsEntry("label", "Cobb 500").containsEntry("type", "broiler");
    assertThat(cobb.isActive()).isTrue();
  }

  @Test
  @SuppressWarnings("unchecked")
  void bundleCarriesItsModuleSet() {
    CatalogItem pro =
        catalogItemRepository
            .findByCategoryAndKeyAndLocale("bundles", "pro_volaille", null)
            .orElseThrow();
    Object modules = pro.getValue().get("modules");
    assertThat(modules).isInstanceOf(java.util.List.class);
    assertThat((java.util.List<String>) modules).contains("module.poultry.broiler");
  }

  @Test
  void allModulesDeclareAWave() {
    assertThat(catalogItemRepository.findByCategory("modules"))
        .allSatisfy(m -> assertThat(m.getValue()).containsKey("wave"));
  }
}
