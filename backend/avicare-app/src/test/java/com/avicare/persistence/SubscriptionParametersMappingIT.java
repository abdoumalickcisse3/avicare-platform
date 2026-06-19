package com.avicare.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.parameters.domain.AlertSeverity;
import com.avicare.parameters.domain.AlertThreshold;
import com.avicare.parameters.domain.CatalogItem;
import com.avicare.parameters.domain.FarmCatalogItem;
import com.avicare.parameters.domain.FarmSetting;
import com.avicare.parameters.domain.PriceList;
import com.avicare.parameters.domain.PriceListItem;
import com.avicare.parameters.domain.UserSetting;
import com.avicare.parameters.repository.AlertThresholdRepository;
import com.avicare.parameters.repository.CatalogItemRepository;
import com.avicare.parameters.repository.FarmCatalogItemRepository;
import com.avicare.parameters.repository.FarmSettingRepository;
import com.avicare.parameters.repository.PriceListItemRepository;
import com.avicare.parameters.repository.PriceListRepository;
import com.avicare.parameters.repository.UserSettingRepository;
import com.avicare.subscription.domain.FeatureMode;
import com.avicare.subscription.domain.RequestStatus;
import com.avicare.subscription.domain.Subscription;
import com.avicare.subscription.domain.SubscriptionChangeRequest;
import com.avicare.subscription.domain.SubscriptionModule;
import com.avicare.subscription.domain.SubscriptionStatus;
import com.avicare.subscription.repository.SubscriptionChangeRequestRepository;
import com.avicare.subscription.repository.SubscriptionModuleRepository;
import com.avicare.subscription.repository.SubscriptionRepository;
import com.avicare.tenancy.domain.Farm;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Proves the V2 + V3 Flyway migrations run on a clean PostgreSQL (on top of V1) and that the
 * subscription/parameters JPA mappings agree with the schema (Hibernate {@code ddl-auto=validate}).
 * Exercises a CRUD round-trip per entity, the JSONB mapping, a UNIQUE constraint and the price-list
 * soft delete. CI-only on dev machines where Testcontainers can't reach Docker (see project
 * memory).
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class SubscriptionParametersMappingIT {

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

  @Autowired private TestEntityManager em;
  @Autowired private SubscriptionRepository subscriptionRepository;
  @Autowired private SubscriptionModuleRepository subscriptionModuleRepository;
  @Autowired private SubscriptionChangeRequestRepository changeRequestRepository;
  @Autowired private CatalogItemRepository catalogItemRepository;
  @Autowired private FarmSettingRepository farmSettingRepository;
  @Autowired private UserSettingRepository userSettingRepository;
  @Autowired private FarmCatalogItemRepository farmCatalogItemRepository;
  @Autowired private PriceListRepository priceListRepository;
  @Autowired private PriceListItemRepository priceListItemRepository;
  @Autowired private AlertThresholdRepository alertThresholdRepository;

  private Long farmId;
  private Long userId;

  @BeforeEach
  void seedFarmAndUser() {
    User user = new User();
    user.setEmail("a4@example.com");
    user.setPasswordHash("$2a$12$abcdefghijklmnopqrstuv");
    user.setFullName("A4 User");
    user.setRole(UserRole.USER);
    userId = em.persistAndGetId(user, Long.class);

    Farm farm = new Farm();
    farm.setName("Ferme A4");
    farm.setCreatedBy(userId);
    farmId = em.persistAndGetId(farm, Long.class);
    em.flush();
    em.clear();
  }

  @Test
  void subscriptionStack_roundTrips() {
    Subscription sub = new Subscription();
    sub.setFarmId(farmId);
    sub.setPlanKey("pro_volaille");
    sub.setStatus(SubscriptionStatus.ACTIVE);
    sub = subscriptionRepository.saveAndFlush(sub);

    SubscriptionModule module = new SubscriptionModule();
    module.setSubscriptionId(sub.getId());
    module.setModuleKey("module.poultry.broiler");
    module.setMode(FeatureMode.HARD);
    subscriptionModuleRepository.saveAndFlush(module);

    SubscriptionChangeRequest cr = new SubscriptionChangeRequest();
    cr.setSubscriptionId(sub.getId());
    cr.setRequestedPlan("ferme_complete");
    cr.setRequestedModules(new ObjectMapper().createObjectNode().put("add", "module.inventory"));
    cr.setStatus(RequestStatus.DRAFT);
    cr.setRequestedBy(userId);
    changeRequestRepository.saveAndFlush(cr);

    em.clear();

    Subscription reloaded = subscriptionRepository.findByFarmId(farmId).orElseThrow();
    assertThat(reloaded.getStatus()).isEqualTo(SubscriptionStatus.ACTIVE);
    assertThat(reloaded.getStartedAt()).isNotNull();
    assertThat(reloaded.getCreatedAt()).isNotNull();

    assertThat(
            subscriptionModuleRepository
                .findBySubscriptionIdAndModuleKey(reloaded.getId(), "module.poultry.broiler")
                .orElseThrow()
                .getMode())
        .isEqualTo(FeatureMode.HARD);

    assertThat(changeRequestRepository.findBySubscriptionId(reloaded.getId())).hasSize(1);
    assertThat(
            changeRequestRepository
                .findBySubscriptionId(reloaded.getId())
                .get(0)
                .getRequestedModules()
                .get("add")
                .asText())
        .isEqualTo("module.inventory");
  }

  @Test
  void parametersStack_roundTripsWithJsonb() {
    CatalogItem catalog = new CatalogItem();
    catalog.setCategory("breeds");
    catalog.setKey("test_strain"); // not a V4-seeded breed, avoids the unique (category,key) clash
    catalog.setValue(Map.of("label", "Cobb 500", "species", "poultry"));
    catalogItemRepository.saveAndFlush(catalog);

    FarmSetting farmSetting = new FarmSetting();
    farmSetting.setFarmId(farmId);
    farmSetting.setKey("default_breed");
    farmSetting.setValue(Map.of("value", "cobb_500"));
    farmSettingRepository.saveAndFlush(farmSetting);

    UserSetting userSetting = new UserSetting();
    userSetting.setUserId(userId);
    userSetting.setKey("date_format");
    userSetting.setValue(Map.of("value", "dd/MM/yyyy"));
    userSettingRepository.saveAndFlush(userSetting);

    FarmCatalogItem override = new FarmCatalogItem();
    override.setFarmId(farmId);
    override.setCategory("breeds");
    override.setKey("cobb_500");
    override.setValue(Map.of("label", "Mes Cobb 500"));
    farmCatalogItemRepository.saveAndFlush(override);

    AlertThreshold threshold = new AlertThreshold();
    threshold.setFarmId(farmId);
    threshold.setThresholdType("mortality_rate");
    threshold.setThresholdValue(new BigDecimal("5.500"));
    threshold.setSeverity(AlertSeverity.CRITICAL);
    alertThresholdRepository.saveAndFlush(threshold);

    em.clear();

    assertThat(
            catalogItemRepository
                .findByCategoryAndKeyAndLocale("breeds", "test_strain", null)
                .orElseThrow()
                .getValue())
        .containsEntry("label", "Cobb 500");
    assertThat(farmSettingRepository.findByFarmIdAndKey(farmId, "default_breed")).isPresent();
    assertThat(userSettingRepository.findByUserIdAndKey(userId, "date_format")).isPresent();
    assertThat(farmCatalogItemRepository.findByFarmIdAndCategory(farmId, "breeds")).hasSize(1);
    assertThat(
            alertThresholdRepository
                .findByFarmIdAndThresholdType(farmId, "mortality_rate")
                .orElseThrow()
                .getSeverity())
        .isEqualTo(AlertSeverity.CRITICAL);
  }

  @Test
  void priceList_softDeleteHidesRowAndItemsRoundTrip() {
    PriceList list = new PriceList();
    list.setFarmId(farmId);
    list.setName("Tarifs 2026");
    list.setDefaultList(true);
    list.setValidFrom(LocalDate.now());
    list = priceListRepository.saveAndFlush(list);
    Long listId = list.getId();

    PriceListItem item = new PriceListItem();
    item.setPriceListId(listId);
    item.setProductKey("poulet_vif_kg");
    item.setUnitPrice(new BigDecimal("2500.00"));
    priceListItemRepository.saveAndFlush(item);
    em.clear();

    assertThat(priceListRepository.findByFarmIdAndDefaultListTrue(farmId)).isPresent();
    assertThat(priceListItemRepository.findByPriceListIdAndProductKey(listId, "poulet_vif_kg"))
        .isPresent();

    priceListRepository.delete(priceListRepository.findById(listId).orElseThrow());
    priceListRepository.flush();
    em.clear();

    // @SQLDelete set deleted_at; @SQLRestriction now hides the row.
    assertThat(priceListRepository.findById(listId)).isEmpty();
  }

  @Test
  void farmSetting_uniqueKeyPerFarmIsEnforced() {
    FarmSetting first = new FarmSetting();
    first.setFarmId(farmId);
    first.setKey("currency");
    first.setValue(Map.of("value", "XOF"));
    farmSettingRepository.saveAndFlush(first);

    FarmSetting dup = new FarmSetting();
    dup.setFarmId(farmId);
    dup.setKey("currency");
    dup.setValue(Map.of("value", "EUR"));

    assertThatThrownBy(() -> farmSettingRepository.saveAndFlush(dup))
        .isInstanceOf(DataIntegrityViolationException.class);
  }
}
