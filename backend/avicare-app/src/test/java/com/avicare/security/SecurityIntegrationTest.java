package com.avicare.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * End-to-end check that Spring Security is now actively wired into the application: public routes
 * stay open, everything else demands authentication and gets a uniform RFC 7807 401.
 *
 * <p>This is the assertion that protects the boot smoke test described in the session plan — if
 * {@code /actuator/health} ever stops being public, this test goes red before a deploy can.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityIntegrationTest {

  @Autowired private MockMvc mockMvc;

  // The DB-less `test` profile excludes JPA autoconfig, so the identity/tenancy repositories the
  // auth beans depend on are mocked to let the full web context load.
  @MockitoBean private UserRepository userRepository;
  @MockitoBean private RefreshTokenRepository refreshTokenRepository;
  @MockitoBean private FarmRepository farmRepository;
  @MockitoBean private PartnerRepository partnerRepository;

  @MockitoBean
  private com.avicare.admin.repository.StaffPermissionRepository staffPermissionRepository;

  @MockitoBean private com.avicare.admin.repository.AdminAuditLogRepository adminAuditLogRepository;
  @MockitoBean private com.avicare.admin.repository.RequestTraceRepository requestTraceRepository;

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

  @Test
  void healthEndpoint_isPublic() throws Exception {
    mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
  }

  @Test
  void unauthenticatedProtectedRoute_returns401ProblemDetails() throws Exception {
    mockMvc
        .perform(get("/api/v1/anything"))
        .andExpect(status().isUnauthorized())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(401))
        .andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
  }
}
