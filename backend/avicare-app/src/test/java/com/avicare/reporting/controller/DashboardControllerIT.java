package com.avicare.reporting.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.api.dto.DayValue;
import com.avicare.common.api.dto.NamedValue;
import com.avicare.common.security.jwt.JwtService;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.security.principal.FarmRole;
import com.avicare.common.security.principal.Membership;
import com.avicare.common.security.principal.UserRole;
import com.avicare.finance.repository.ExpenseRepository;
import com.avicare.finance.repository.SalaryAdvanceRepository;
import com.avicare.finance.repository.SalaryRepository;
import com.avicare.finance.repository.SalarySettingRepository;
import com.avicare.identity.repository.RefreshTokenRepository;
import com.avicare.identity.repository.UserRepository;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.livestock.repository.ClientRepository;
import com.avicare.livestock.repository.DailyEggProductionRepository;
import com.avicare.livestock.repository.DailyRecordRepository;
import com.avicare.livestock.repository.DeliveryRepository;
import com.avicare.livestock.repository.EggCollectionRepository;
import com.avicare.livestock.repository.EggTrayStockRepository;
import com.avicare.livestock.repository.FeedFormulaRepository;
import com.avicare.livestock.repository.GrowthPerformanceRepository;
import com.avicare.livestock.repository.HealthObservationRepository;
import com.avicare.livestock.repository.InvoiceRepository;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.OrderRepository;
import com.avicare.livestock.repository.PaymentRepository;
import com.avicare.livestock.repository.PoultryBatchRepository;
import com.avicare.livestock.repository.ProductionUnitRepository;
import com.avicare.livestock.repository.PurchaseOrderItemRepository;
import com.avicare.livestock.repository.PurchaseOrderRepository;
import com.avicare.livestock.repository.SaleItemRepository;
import com.avicare.livestock.repository.SaleRepository;
import com.avicare.livestock.repository.StockItemRepository;
import com.avicare.livestock.repository.StockMovementRepository;
import com.avicare.livestock.repository.SupplierRepository;
import com.avicare.livestock.repository.TreatmentExecutedRepository;
import com.avicare.livestock.repository.VaccinationProgramLotRepository;
import com.avicare.livestock.repository.VaccinationRepository;
import com.avicare.livestock.repository.VetVisitRepository;
import com.avicare.livestock.repository.VeterinarianRepository;
import com.avicare.livestock.repository.WeighingSampleRepository;
import com.avicare.parameters.repository.AlertThresholdRepository;
import com.avicare.parameters.repository.CatalogItemRepository;
import com.avicare.parameters.repository.FarmCatalogItemRepository;
import com.avicare.parameters.repository.FarmSettingRepository;
import com.avicare.parameters.repository.PriceListItemRepository;
import com.avicare.parameters.repository.PriceListRepository;
import com.avicare.parameters.repository.UserSettingRepository;
import com.avicare.reporting.api.dto.DashboardResponse;
import com.avicare.reporting.api.dto.DashboardResponse.CommercialSection;
import com.avicare.reporting.api.dto.DashboardResponse.PeriodInfo;
import com.avicare.reporting.service.ReportingService;
import com.avicare.subscription.api.SubscriptionFacade;
import com.avicare.subscription.repository.SubscriptionChangeRequestRepository;
import com.avicare.subscription.repository.SubscriptionModuleRepository;
import com.avicare.subscription.repository.SubscriptionRepository;
import com.avicare.tenancy.repository.FarmRepository;
import com.avicare.tenancy.repository.UserFarmRepository;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.Base64;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * DB-less controller integration test for the dashboard endpoint. Verifies access control (401
 * without token), gating logic (200 with active commercial module showing non-null section), and
 * period validation (422 for unknown preset). Uses the test profile (no JPA/Flyway/Redis).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DashboardControllerIT {

  private static final KeyPair KEYS = generateKeys();
  private static final Long FARM_ID = 42L;

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtService jwtService;

  // Mock ReportingService and SubscriptionFacade directly — DB-less context.
  @MockitoBean private ReportingService reportingService;
  @MockitoBean private SubscriptionFacade subscriptionFacade;

  // DB-less `test` profile mocks — same list as SecurityE2ETest.
  @MockitoBean private UserRepository userRepository;
  @MockitoBean private RefreshTokenRepository refreshTokenRepository;
  @MockitoBean private FarmRepository farmRepository;
  @MockitoBean private UserFarmRepository userFarmRepository;
  @MockitoBean private FarmSettingRepository farmSettingRepository;
  @MockitoBean private UserSettingRepository userSettingRepository;
  @MockitoBean private CatalogItemRepository catalogItemRepository;
  @MockitoBean private FarmCatalogItemRepository farmCatalogItemRepository;
  @MockitoBean private PriceListRepository priceListRepository;
  @MockitoBean private PriceListItemRepository priceListItemRepository;
  @MockitoBean private AlertThresholdRepository alertThresholdRepository;
  @MockitoBean private SubscriptionRepository subscriptionRepository;
  @MockitoBean private SubscriptionModuleRepository subscriptionModuleRepository;
  @MockitoBean private SubscriptionChangeRequestRepository subscriptionChangeRequestRepository;
  @MockitoBean private BreedRepository breedRepository;
  @MockitoBean private ProductionUnitRepository productionUnitRepository;
  @MockitoBean private LifecycleEventRepository lifecycleEventRepository;
  @MockitoBean private PoultryBatchRepository poultryBatchRepository;
  @MockitoBean private DailyRecordRepository dailyRecordRepository;
  @MockitoBean private WeighingSampleRepository weighingSampleRepository;
  @MockitoBean private GrowthPerformanceRepository growthPerformanceRepository;
  @MockitoBean private EggCollectionRepository eggCollectionRepository;
  @MockitoBean private EggTrayStockRepository eggTrayStockRepository;
  @MockitoBean private DailyEggProductionRepository dailyEggProductionRepository;
  @MockitoBean private VaccinationRepository vaccinationRepository;
  @MockitoBean private VaccinationProgramLotRepository vaccinationProgramLotRepository;
  @MockitoBean private HealthObservationRepository healthObservationRepository;
  @MockitoBean private VeterinarianRepository veterinarianRepository;
  @MockitoBean private TreatmentExecutedRepository treatmentExecutedRepository;
  @MockitoBean private VetVisitRepository vetVisitRepository;
  @MockitoBean private StockItemRepository stockItemRepository;
  @MockitoBean private StockMovementRepository stockMovementRepository;
  @MockitoBean private PurchaseOrderRepository purchaseOrderRepository;
  @MockitoBean private PurchaseOrderItemRepository purchaseOrderItemRepository;
  @MockitoBean private FeedFormulaRepository feedFormulaRepository;
  @MockitoBean private SupplierRepository supplierRepository;
  @MockitoBean private ClientRepository clientRepository;
  @MockitoBean private OrderRepository orderRepository;
  @MockitoBean private SaleRepository saleRepository;
  @MockitoBean private SaleItemRepository saleItemRepository;
  @MockitoBean private ExpenseRepository expenseRepository;
  @MockitoBean private DeliveryRepository deliveryRepository;
  @MockitoBean private InvoiceRepository invoiceRepository;
  @MockitoBean private PaymentRepository paymentRepository;
  @MockitoBean private SalarySettingRepository salarySettingRepository;
  @MockitoBean private SalaryRepository salaryRepository;
  @MockitoBean private SalaryAdvanceRepository salaryAdvanceRepository;

  @MockitoBean
  private com.avicare.assistant.audit.AssistantAuditRepository assistantAuditRepository;

  @MockitoBean
  private com.avicare.assistant.confirm.PendingActionRepository pendingActionRepository;

  @DynamicPropertySource
  static void jwtKeys(DynamicPropertyRegistry registry) {
    registry.add("avicare.security.jwt.private-key", () -> privatePem(KEYS));
    registry.add("avicare.security.jwt.public-key", () -> publicPem(KEYS));
  }

  @Test
  void noToken_returns401() throws Exception {
    mockMvc
        .perform(get("/api/v1/farms/" + FARM_ID + "/dashboard"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void memberWithCommercialModule_returns200_withCommercialSection() throws Exception {
    DashboardResponse mockResponse =
        new DashboardResponse(
            new PeriodInfo("preset", "30d", "2026-05-28", "2026-06-27"),
            new CommercialSection(
                0L,
                List.<DayValue>of(),
                0L,
                0L,
                List.<NamedValue>of(),
                List.<NamedValue>of(),
                0L,
                0L),
            null,
            null);
    when(reportingService.buildDashboard(anyLong(), any())).thenReturn(mockResponse);

    String token = memberToken(FARM_ID);
    mockMvc
        .perform(
            get("/api/v1/farms/" + FARM_ID + "/dashboard")
                .header("Authorization", "Bearer " + token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.period.value").value("30d"))
        .andExpect(jsonPath("$.data.commercial").exists())
        .andExpect(jsonPath("$.data.inventory").doesNotExist())
        .andExpect(jsonPath("$.data.livestock").doesNotExist());
  }

  @Test
  void unknownPreset_returns422() throws Exception {
    String token = memberToken(FARM_ID);
    mockMvc
        .perform(
            get("/api/v1/farms/" + FARM_ID + "/dashboard")
                .header("Authorization", "Bearer " + token)
                .param("period", "yearly"))
        .andExpect(status().isUnprocessableEntity());
  }

  private String memberToken(Long farmId) {
    return jwtService.generateAccessToken(
        new AvicarePrincipal(
            10L,
            "member@avicare.com",
            UserRole.USER,
            List.of(new Membership(farmId, FarmRole.FARMER, List.of("*")))));
  }

  // --- in-memory RSA key material ---

  private static KeyPair generateKeys() {
    try {
      KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
      gen.initialize(2048);
      return gen.generateKeyPair();
    } catch (Exception e) {
      throw new IllegalStateException("Cannot generate RSA key pair", e);
    }
  }

  private static String privatePem(KeyPair pair) {
    String b64 =
        Base64.getEncoder().encodeToString(((RSAPrivateKey) pair.getPrivate()).getEncoded());
    return "-----BEGIN PRIVATE KEY-----\n" + wrap(b64) + "\n-----END PRIVATE KEY-----";
  }

  private static String publicPem(KeyPair pair) {
    String b64 = Base64.getEncoder().encodeToString(((RSAPublicKey) pair.getPublic()).getEncoded());
    return "-----BEGIN PUBLIC KEY-----\n" + wrap(b64) + "\n-----END PUBLIC KEY-----";
  }

  private static String wrap(String base64) {
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < base64.length(); i += 64) {
      sb.append(base64, i, Math.min(i + 64, base64.length())).append('\n');
    }
    return sb.toString().stripTrailing();
  }
}
