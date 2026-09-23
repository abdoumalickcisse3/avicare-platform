package com.avicare.tenancy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.Client;
import com.avicare.livestock.domain.ClientType;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Sale;
import com.avicare.livestock.domain.SaleItem;
import com.avicare.livestock.domain.SaleStatus;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.tenancy.api.TenancyFacade;
import com.avicare.tenancy.domain.Farm;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
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
 * Self-service account deletion (App Store rule 5.1.1(v)) purges a farm with a single {@code DELETE
 * FROM farms}, relying on every table's foreign keys cascading all the way down. A farm with real
 * activity — a sale tied to a production unit — used to 500 here: {@code
 * sale_items.production_unit_id} had no {@code ON DELETE} action, so Postgres refused to delete the
 * production unit out from under it even though the sale item was itself about to disappear via
 * {@code sales -> farms}. Fixed in V58 (and 25 sibling constraints found the same way, audited
 * against the live schema, not guessed from code).
 */
@SpringBootTest
@Testcontainers
@Transactional
class FarmPurgeCascadeIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.enabled", () -> "true");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
  }

  @Autowired private TenancyFacade tenancyFacade;
  @Autowired private EntityManager em;

  @Test
  void purgeFarm_withASaleTiedToAProductionUnit_doesNotThrow() {
    User u = new User();
    u.setEmail("purge@example.com");
    u.setPasswordHash("$2a$12$abcdefghijklmnopqrstuv");
    u.setFullName("Purge Test");
    u.setRole(UserRole.USER);
    em.persist(u);

    Farm f = new Farm();
    f.setName("Ferme a purger");
    f.setCreatedBy(u.getId());
    em.persist(f);
    em.flush();

    ProductionUnit unit = new ProductionUnit();
    unit.setFarmId(f.getId());
    unit.setSpecies(Species.POULTRY);
    unit.setUnitKind(UnitKind.BATCH);
    unit.setName("Lot a purger");
    unit.setStartDate(LocalDate.now());
    unit.setCurrentCount(100);
    unit.setStatus(UnitStatus.ACTIVE);
    em.persist(unit);

    Client client = new Client();
    client.setFarmId(f.getId());
    client.setClientType(ClientType.INDIVIDUAL);
    client.setDisplayName("Client a purger");
    em.persist(client);
    em.flush();

    Sale sale = new Sale();
    sale.setFarmId(f.getId());
    sale.setSaleNumber("V-2026-001");
    sale.setClient(client);
    sale.setStatus(SaleStatus.COMPLETED);
    sale.setSaleDate(LocalDate.now());
    sale.setTotalXof(10_000L);
    em.persist(sale);
    em.flush();

    SaleItem item = new SaleItem();
    item.setSale(sale);
    item.setArticleKey("poulet-vif");
    item.setArticleSource(ArticleSource.PRODUCTION);
    item.setUnit("tete");
    item.setQuantity(BigDecimal.TEN);
    item.setUnitPriceXof(1_000);
    item.setLineTotalXof(10_000L);
    // The cross-reference that used to break the purge: sale_items -> production_units had no
    // ON DELETE, even though both rows disappear via the same farm.
    item.setProductionUnitId(unit.getId());
    em.persist(item);
    em.flush();

    Long farmId = f.getId();
    assertThatCode(() -> tenancyFacade.purgeFarm(farmId)).doesNotThrowAnyException();

    em.flush();
    em.clear();
    assertThat(em.find(Farm.class, farmId)).isNull();
  }
}
