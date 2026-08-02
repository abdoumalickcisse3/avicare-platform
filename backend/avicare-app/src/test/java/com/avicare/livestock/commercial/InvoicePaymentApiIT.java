package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.support.RsaKeys;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.KeyPair;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * End-to-end commercial REST — invoices + payments + client credit (Sprint B5-5c) on a real
 * PostgreSQL (Testcontainers, V1–V23): owner happy path (invoice from sale → encours; partial then
 * full payment → status + encours; void; overdue listing; credit endpoint), overpayment 422,
 * feature gating (403), RBAC (FARMER may neither invoice nor pay) and cross-farm 404. Gating FORCED
 * ON. CI-only where Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class InvoicePaymentApiIT {

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  private static final KeyPair KEYS = RsaKeys.generate();

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.enabled", () -> "true");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    registry.add("avicare.security.jwt.private-key", () -> RsaKeys.privatePem(KEYS));
    registry.add("avicare.security.jwt.public-key", () -> RsaKeys.publicPem(KEYS));
    registry.add("avicare.features.gating-enabled", () -> "true");
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void ownerHappyPath_invoiceFromSale_payments_credit_overdue() throws Exception {
    String owner = onboardOwner("ip-happy");
    long farmId = createFarm(owner, "Ferme IP");
    owner = relogin("ip-happy");
    enableModule(owner, farmId, "module.commercial.basic");
    String base = "/api/v1/farms/" + farmId + "/commercial";
    long clientId = createClient(owner, base, "Ferme du Soleil", 500000);

    long saleId =
        data(postOk(base + "/sales", owner, saleBody(clientId, 10, 3000))).get("id").asLong();

    // invoice from sale (due yesterday → overdue) → ISSUED, encours += 30000
    JsonNode invoice =
        data(
            postOk(
                base + "/invoices/from-sale",
                owner,
                String.format(
                    "{\"saleId\":%d,\"dueDate\":\"%s\"}", saleId, LocalDate.now().minusDays(1))));
    long invoiceId = invoice.get("id").asLong();
    assertThat(invoice.get("status").asText()).isEqualTo("ISSUED");
    assertThat(invoice.get("invoiceNumber").asText()).startsWith("F-");
    assertThat(invoice.get("totalXof").asLong()).isEqualTo(30_000L);
    assertThat(credit(base, owner, clientId)).isEqualTo(30_000L);

    // overdue listing contains it
    assertThat(data(getOk(base + "/invoices/overdue", owner)).get(0).get("id").asLong())
        .isEqualTo(invoiceId);

    // partial payment → PARTIALLY_PAID, encours 20000
    JsonNode p1 =
        data(
            postOk(
                base + "/payments",
                owner,
                String.format(
                    "{\"invoiceId\":%d,\"amountXof\":10000,\"method\":\"MOBILE_MONEY\"}",
                    invoiceId)));
    assertThat(p1.get("paymentNumber").asText()).startsWith("P-");
    assertThat(data(getOk(base + "/invoices/" + invoiceId, owner)).get("status").asText())
        .isEqualTo("PARTIALLY_PAID");
    assertThat(credit(base, owner, clientId)).isEqualTo(20_000L);

    // overpayment refused (outstanding 20000)
    mockMvc
        .perform(
            post(base + "/payments")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    String.format(
                        "{\"invoiceId\":%d,\"amountXof\":99000,\"method\":\"CASH\"}", invoiceId)))
        .andExpect(status().isUnprocessableEntity());

    // pay the rest → PAID, encours 0
    long p2 =
        data(postOk(
                base + "/payments",
                owner,
                String.format(
                    "{\"invoiceId\":%d,\"amountXof\":20000,\"method\":\"CASH\"}", invoiceId)))
            .get("id")
            .asLong();
    assertThat(data(getOk(base + "/invoices/" + invoiceId, owner)).get("status").asText())
        .isEqualTo("PAID");
    assertThat(credit(base, owner, clientId)).isZero();

    // void p2 → back to PARTIALLY_PAID, encours 20000
    postOk(base + "/payments/" + p2 + "/void", owner, "{\"reason\":\"erreur\"}");
    assertThat(data(getOk(base + "/invoices/" + invoiceId, owner)).get("status").asText())
        .isEqualTo("PARTIALLY_PAID");
    assertThat(credit(base, owner, clientId)).isEqualTo(20_000L);
  }

  @Test
  void invoicesEndpoint_withoutModule_returns403() throws Exception {
    String owner = onboardOwner("ip-gate");
    long farmId = createFarm(owner, "Ferme Sans Module");
    owner = relogin("ip-gate");
    // Farm creation auto-provisions every V1 module (ADR-009); turn commercial off.
    disableModule(owner, farmId, "module.commercial.basic");
    mockMvc
        .perform(
            get("/api/v1/farms/" + farmId + "/commercial/invoices")
                .header("Authorization", "Bearer " + owner))
        .andExpect(status().isForbidden());
  }

  @Test
  void farmer_cannotInvoice_norPay() throws Exception {
    String owner = onboardOwner("ip-rbac");
    long farmId = createFarm(owner, "Ferme RBAC");
    owner = relogin("ip-rbac");
    enableModule(owner, farmId, "module.commercial.basic");
    String base = "/api/v1/farms/" + farmId + "/commercial";
    long clientId = createClient(owner, base, "Client", null);
    long saleId =
        data(postOk(base + "/sales", owner, saleBody(clientId, 1, 3000))).get("id").asLong();

    String farmerPw = addMember(owner, farmId, "Farmer Ip", "ip-farmer@co.io", "FARMER");
    String farmer = loginWith("ip-farmer@co.io", farmerPw);

    mockMvc
        .perform(
            post(base + "/invoices/from-sale")
                .header("Authorization", "Bearer " + farmer)
                .contentType(MediaType.APPLICATION_JSON)
                .content(String.format("{\"saleId\":%d}", saleId)))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(
            post(base + "/payments")
                .header("Authorization", "Bearer " + farmer)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"invoiceId\":1,\"amountXof\":1,\"method\":\"CASH\"}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void crossFarm_invoice_returns404() throws Exception {
    String a = onboardOwner("ip-fa");
    long farmA = createFarm(a, "Ferme A");
    a = relogin("ip-fa");
    enableModule(a, farmA, "module.commercial.basic");
    String baseA = "/api/v1/farms/" + farmA + "/commercial";
    long clientA = createClient(a, baseA, "A", null);
    long saleA = data(postOk(baseA + "/sales", a, saleBody(clientA, 1, 3000))).get("id").asLong();
    long invoiceA =
        data(postOk(baseA + "/invoices/from-sale", a, String.format("{\"saleId\":%d}", saleA)))
            .get("id")
            .asLong();

    String b = onboardOwner("ip-fb");
    long farmB = createFarm(b, "Ferme B");
    b = relogin("ip-fb");
    enableModule(b, farmB, "module.commercial.basic");

    mockMvc
        .perform(
            get("/api/v1/farms/" + farmB + "/commercial/invoices/" + invoiceA)
                .header("Authorization", "Bearer " + b))
        .andExpect(status().isNotFound());
  }

  // --- helpers --------------------------------------------------------

  private long credit(String base, String token, long clientId) throws Exception {
    return data(getOk(base + "/clients/" + clientId + "/credit", token))
        .get("currentBalanceXof")
        .asLong();
  }

  private long createClient(String token, String base, String name, Integer creditLimit)
      throws Exception {
    String body =
        creditLimit != null
            ? String.format(
                "{\"clientType\":\"BUSINESS\",\"displayName\":\"%s\",\"creditLimitXof\":%d}",
                name, creditLimit)
            : String.format("{\"clientType\":\"BUSINESS\",\"displayName\":\"%s\"}", name);
    return data(postOk(base + "/clients", token, body)).get("id").asLong();
  }

  private static String saleBody(long clientId, int qty, int price) {
    return String.format(
        "{\"clientId\":%d,\"paymentMethod\":\"CREDIT\",\"lines\":[{\"articleKey\":\"eggs_consumption\",\"articleSource\":\"INVENTORY\",\"quantity\":%d,\"unitPriceXof\":%d}]}",
        clientId, qty, price);
  }

  private JsonNode data(JsonNode response) {
    return response.get("data");
  }

  private JsonNode getOk(String url, String token) throws Exception {
    return read(
        mockMvc
            .perform(get(url).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()));
  }

  private JsonNode postOk(String url, String token, String body) throws Exception {
    var req = post(url).header("Authorization", "Bearer " + token);
    if (body != null) {
      req = req.contentType(MediaType.APPLICATION_JSON).content(body);
    }
    return read(mockMvc.perform(req).andExpect(status().is2xxSuccessful()));
  }

  private JsonNode read(org.springframework.test.web.servlet.ResultActions actions)
      throws Exception {
    return objectMapper.readTree(actions.andReturn().getResponse().getContentAsString());
  }

  private String onboardOwner(String slug) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\""
                        + slug
                        + "@co.io\",\"password\":\"password123\",\"fullName\":\"U\"}"))
        .andExpect(status().isCreated());
    return relogin(slug);
  }

  private String relogin(String slug) throws Exception {
    String json =
        mockMvc
            .perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"" + slug + "@co.io\",\"password\":\"password123\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("accessToken").asText();
  }

  private long createFarm(String token, String name) throws Exception {
    String json =
        mockMvc
            .perform(
                post("/api/v1/farms")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"" + name + "\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("id").asLong();
  }

  private void enableModule(String token, long farmId, String moduleKey) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/farms/" + farmId + "/subscription/modules")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"moduleKey\":\"" + moduleKey + "\",\"mode\":\"HARD\"}"))
        .andExpect(status().isCreated());
  }

  private void disableModule(String token, long farmId, String moduleKey) throws Exception {
    mockMvc
        .perform(
            delete("/api/v1/farms/" + farmId + "/subscription/modules/" + moduleKey)
                .header("Authorization", "Bearer " + token))
        .andExpect(status().isNoContent());
  }

  private String addMember(
      String ownerToken, long farmId, String fullName, String email, String role) throws Exception {
    String json =
        mockMvc
            .perform(
                post("/api/v1/farms/" + farmId + "/users")
                    .header("Authorization", "Bearer " + ownerToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        "{\"fullName\":\""
                            + fullName
                            + "\",\"email\":\""
                            + email
                            + "\",\"role\":\""
                            + role
                            + "\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("temporaryPassword").asText();
  }

  private String loginWith(String email, String password) throws Exception {
    String json =
        mockMvc
            .perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("accessToken").asText();
  }
}
