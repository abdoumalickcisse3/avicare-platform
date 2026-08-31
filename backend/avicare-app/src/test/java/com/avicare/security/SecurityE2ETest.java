package com.avicare.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.security.jwt.JwtService;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.security.principal.FarmRole;
import com.avicare.common.security.principal.Membership;
import com.avicare.common.security.principal.UserRole;
import com.avicare.common.tenancy.context.TenancyContext;
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
import com.avicare.livestock.repository.InvoiceItemRepository;
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
import com.avicare.notification.repository.AnnouncementRepository;
import com.avicare.parameters.repository.AlertThresholdRepository;
import com.avicare.parameters.repository.CatalogItemRepository;
import com.avicare.parameters.repository.FarmCatalogItemRepository;
import com.avicare.parameters.repository.FarmSettingRepository;
import com.avicare.parameters.repository.PriceListItemRepository;
import com.avicare.parameters.repository.PriceListRepository;
import com.avicare.parameters.repository.UserSettingRepository;
import com.avicare.partner.repository.PartnerAlertRepository;
import com.avicare.partner.repository.PartnerFarmMembershipRepository;
import com.avicare.partner.repository.PartnerInviteCodeRepository;
import com.avicare.partner.repository.PartnerRefreshTokenRepository;
import com.avicare.partner.repository.PartnerRepository;
import com.avicare.partner.repository.PartnerUserRepository;
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
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Full security-chain end-to-end test: a real RSA-signed access token flows through {@link
 * com.avicare.common.security.jwt.JwtFilter} → {@link TenancyContext} + the Spring security context
 * → a {@code @PreAuthorize("@farmAccess...")} method, exercising every layer wired in PR #15 and
 * the {@code FarmAccessChecker} from Session 4b-1.
 *
 * <p>Test-only: the protected endpoint and RSA keys live entirely in test scope (no production
 * code). Keys are generated in-memory and injected via {@link DynamicPropertySource} so {@code
 * JwtService} can both mint and verify the tokens used here.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(SecurityE2ETest.SecureController.class)
class SecurityE2ETest {

  private static final KeyPair KEYS = generateKeys();

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtService jwtService;

  // The DB-less `test` profile excludes JPA autoconfig; mock the repositories the auth beans need.
  @MockitoBean private UserRepository userRepository;
  @MockitoBean private RefreshTokenRepository refreshTokenRepository;
  @MockitoBean private FarmRepository farmRepository;
  @MockitoBean private PartnerRepository partnerRepository;

  @MockitoBean
  private com.avicare.admin.repository.StaffPermissionRepository staffPermissionRepository;

  @MockitoBean private com.avicare.admin.repository.AdminAuditLogRepository adminAuditLogRepository;
  @MockitoBean private com.avicare.admin.repository.RequestTraceRepository requestTraceRepository;
  @MockitoBean private com.avicare.subscription.flags.FeatureFlagRepository featureFlagRepository;

  @MockitoBean
  private com.avicare.integrity.repository.IntegrityFindingRepository integrityFindingRepository;

  @MockitoBean
  private com.avicare.identity.repository.PasswordResetCodeRepository passwordResetCodeRepository;

  @MockitoBean private PartnerAlertRepository partnerAlertRepository;
  @MockitoBean private PartnerUserRepository partnerUserRepository;
  @MockitoBean private PartnerRefreshTokenRepository partnerRefreshTokenRepository;
  @MockitoBean private PartnerFarmMembershipRepository partnerFarmMembershipRepository;
  @MockitoBean private PartnerInviteCodeRepository partnerInviteCodeRepository;
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
  @MockitoBean private InvoiceItemRepository invoiceItemRepository;
  @MockitoBean private AnnouncementRepository announcementRepository;
  @MockitoBean private DeliveryRepository deliveryRepository;
  @MockitoBean private InvoiceRepository invoiceRepository;
  @MockitoBean private PaymentRepository paymentRepository;
  @MockitoBean private ExpenseRepository expenseRepository;
  @MockitoBean private SalarySettingRepository salarySettingRepository;
  @MockitoBean private SalaryRepository salaryRepository;
  @MockitoBean private SalaryAdvanceRepository salaryAdvanceRepository;

  @MockitoBean
  private com.avicare.assistant.audit.AssistantAuditRepository assistantAuditRepository;

  @MockitoBean
  private com.avicare.assistant.confirm.PendingActionRepository pendingActionRepository;

  @MockitoBean
  private com.avicare.notification.repository.NotificationRepository notificationRepository;

  @MockitoBean
  private com.avicare.notification.repository.NotificationReadRepository notificationReadRepository;

  @MockitoBean
  private com.avicare.notification.repository.NotificationPreferenceRepository
      notificationPreferenceRepository;

  @MockitoBean
  private com.avicare.notification.whatsapp.WhatsappOutboxRepository whatsappOutboxRepository;

  @DynamicPropertySource
  static void jwtKeys(DynamicPropertyRegistry registry) {
    registry.add("avicare.security.jwt.private-key", () -> privatePem(KEYS));
    registry.add("avicare.security.jwt.public-key", () -> publicPem(KEYS));
  }

  @Test
  void validTokenWithPermission_reachesEndpointAndExposesTenancy() throws Exception {
    String token = tokenFor(7L, new Membership(42L, FarmRole.FARMER, List.of("poultry:write")));

    mockMvc
        .perform(get("/api/v1/test/farms/42/secure").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.userId").value(7))
        .andExpect(jsonPath("$.farmId").value(42));
  }

  @Test
  void validTokenWithoutPermission_isForbiddenByFarmAccess() throws Exception {
    // Same farm, but only read permission -> @farmAccess.hasPermission(.., 'poultry:write') denies.
    String token = tokenFor(8L, new Membership(42L, FarmRole.FARMER, List.of("poultry:read")));

    // A @PreAuthorize denial is raised during controller invocation, so it is mapped by
    // common-api's GlobalExceptionHandler (RFC 7807 body, code ACCESS_DENIED) — not by the
    // SecurityConfig accessDeniedHandler, which only covers request-level authorization.
    mockMvc
        .perform(get("/api/v1/test/farms/42/secure").header("Authorization", "Bearer " + token))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
  }

  @Test
  void validTokenOnUnreachableFarm_isForbidden() throws Exception {
    // Has poultry:write on farm 42 but requests farm 99 (no membership) -> denied.
    String token = tokenFor(9L, new Membership(42L, FarmRole.FARMER, List.of("poultry:write")));

    mockMvc
        .perform(get("/api/v1/test/farms/99/secure").header("Authorization", "Bearer " + token))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
  }

  @Test
  void noToken_isUnauthorized() throws Exception {
    mockMvc
        .perform(get("/api/v1/test/farms/42/secure"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
  }

  private String tokenFor(Long userId, Membership membership) {
    return jwtService.generateAccessToken(
        new AvicarePrincipal(
            userId, "user" + userId + "@avicare.com", UserRole.USER, List.of(membership)));
  }

  /** Test-only controller protected by the tenant-level SpEL check. */
  @RestController
  static class SecureController {

    @GetMapping("/api/v1/test/farms/{farmId}/secure")
    @PreAuthorize("@farmAccess.hasPermission(#farmId, 'poultry:write')")
    Map<String, Object> secure(@PathVariable Long farmId) {
      return Map.of("farmId", farmId, "userId", TenancyContext.currentUserId());
    }
  }

  // --- in-memory RSA key material (mirrors common-security's RsaTestKeys, which is
  // package-private) ---

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
