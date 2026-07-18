package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.support.RsaKeys;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.KeyPair;
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
 * End-to-end commercial REST — sales + deliveries (Sprint B5-5b) on a real PostgreSQL
 * (Testcontainers, V1–V23): owner happy path (direct sale + cancel; order→delivery→cancel), feature
 * gating (403), RBAC (FARMER may deliver but not sell nor cancel a delivery) and cross-farm
 * isolation (404). Gating FORCED ON. CI-only where Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class SaleDeliveryApiIT {

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
  void ownerHappyPath_sale_andOrderToDelivery() throws Exception {
    String owner = onboardOwner("sd-happy");
    long farmId = createFarm(owner, "Ferme SD");
    owner = relogin("sd-happy");
    enableModule(owner, farmId, "module.commercial.basic");
    String base = "/api/v1/farms/" + farmId + "/commercial";
    long clientId = createClient(owner, base, "Ferme du Soleil");

    // direct sale → COMPLETED, V-number, total
    JsonNode sale =
        data(postOk(base + "/sales", owner, saleBody(clientId, "eggs_consumption", 10, 3000)));
    long saleId = sale.get("id").asLong();
    assertThat(sale.get("status").asText()).isEqualTo("COMPLETED");
    assertThat(sale.get("saleNumber").asText()).startsWith("V-");
    assertThat(sale.get("totalXof").asLong()).isEqualTo(30_000L);
    assertThat(
            data(postOk(base + "/sales/" + saleId + "/cancel", owner, "{\"reason\":\"x\"}"))
                .get("status")
                .asText())
        .isEqualTo("CANCELLED");

    // order → confirm → prepare → deliver
    long orderId = createInProgressOrder(owner, base, clientId);
    JsonNode delivery =
        data(
            postOk(
                base + "/deliveries",
                owner,
                String.format("{\"orderId\":%d,\"carrier\":\"Moussa\"}", orderId)));
    long deliveryId = delivery.get("id").asLong();
    assertThat(delivery.get("status").asText()).isEqualTo("DELIVERED");
    assertThat(delivery.get("deliveryNumber").asText()).startsWith("LIV-");
    assertThat(data(getOk(base + "/orders/" + orderId, owner)).get("status").asText())
        .isEqualTo("DELIVERED");

    // cancel delivery → reopens the order
    assertThat(
            data(postOk(
                    base + "/deliveries/" + deliveryId + "/cancel",
                    owner,
                    "{\"reason\":\"retour\"}"))
                .get("status")
                .asText())
        .isEqualTo("CANCELLED");
    assertThat(data(getOk(base + "/orders/" + orderId, owner)).get("status").asText())
        .isEqualTo("IN_PROGRESS");
  }

  @Test
  void sale_withSalesChannelKey_persistsAndReturnsIt() throws Exception {
    String owner = onboardOwner("sd-channel");
    long farmId = createFarm(owner, "Ferme Canal");
    owner = relogin("sd-channel");
    enableModule(owner, farmId, "module.commercial.basic");
    String base = "/api/v1/farms/" + farmId + "/commercial";
    long clientId = createClient(owner, base, "Client Canal");

    JsonNode sale =
        data(
            postOk(
                base + "/sales",
                owner,
                saleBodyWithChannel(clientId, "eggs_consumption", 10, 3000, "retail")));
    long saleId = sale.get("id").asLong();
    assertThat(sale.get("salesChannelKey").asText()).isEqualTo("retail");

    JsonNode fetched = data(getOk(base + "/sales/" + saleId, owner));
    assertThat(fetched.get("salesChannelKey").asText()).isEqualTo("retail");
  }

  @Test
  void salesEndpoint_withoutModule_returns403() throws Exception {
    String owner = onboardOwner("sd-gate");
    long farmId = createFarm(owner, "Ferme Sans Module");
    owner = relogin("sd-gate");
    mockMvc
        .perform(
            get("/api/v1/farms/" + farmId + "/commercial/sales")
                .header("Authorization", "Bearer " + owner))
        .andExpect(status().isForbidden());
  }

  @Test
  void farmer_canDeliver_butNotSell_norCancelDelivery() throws Exception {
    String owner = onboardOwner("sd-rbac");
    long farmId = createFarm(owner, "Ferme RBAC");
    owner = relogin("sd-rbac");
    enableModule(owner, farmId, "module.commercial.basic");
    String base = "/api/v1/farms/" + farmId + "/commercial";
    long clientId = createClient(owner, base, "Client");

    String farmerPw = addMember(owner, farmId, "Farmer Sd", "sd-farmer@co.io", "FARMER");
    String farmer = loginWith("sd-farmer@co.io", farmerPw);

    // FARMER drives an order to IN_PROGRESS then delivers it (field ops)
    long orderId = createInProgressOrder(farmer, base, clientId);
    long deliveryId =
        data(postOk(base + "/deliveries", farmer, String.format("{\"orderId\":%d}", orderId)))
            .get("id")
            .asLong();

    // FARMER may NOT sell (supervisory) nor cancel a delivery (supervisory)
    mockMvc
        .perform(
            post(base + "/sales")
                .header("Authorization", "Bearer " + farmer)
                .contentType(MediaType.APPLICATION_JSON)
                .content(saleBody(clientId, "eggs_consumption", 1, 3000)))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(
            post(base + "/deliveries/" + deliveryId + "/cancel")
                .header("Authorization", "Bearer " + farmer)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"no\"}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void crossFarm_sale_returns404() throws Exception {
    String a = onboardOwner("sd-fa");
    long farmA = createFarm(a, "Ferme A");
    a = relogin("sd-fa");
    enableModule(a, farmA, "module.commercial.basic");
    String baseA = "/api/v1/farms/" + farmA + "/commercial";
    long clientA = createClient(a, baseA, "A");
    long saleA =
        data(postOk(baseA + "/sales", a, saleBody(clientA, "eggs_consumption", 1, 3000)))
            .get("id")
            .asLong();

    String b = onboardOwner("sd-fb");
    long farmB = createFarm(b, "Ferme B");
    b = relogin("sd-fb");
    enableModule(b, farmB, "module.commercial.basic");

    mockMvc
        .perform(
            get("/api/v1/farms/" + farmB + "/commercial/sales/" + saleA)
                .header("Authorization", "Bearer " + b))
        .andExpect(status().isNotFound());
  }

  // --- helpers --------------------------------------------------------

  private long createClient(String token, String base, String name) throws Exception {
    return data(postOk(
            base + "/clients",
            token,
            "{\"clientType\":\"BUSINESS\",\"displayName\":\"" + name + "\"}"))
        .get("id")
        .asLong();
  }

  private long createInProgressOrder(String token, String base, long clientId) throws Exception {
    long orderId =
        data(postOk(
                base + "/orders",
                token,
                String.format(
                    "{\"clientId\":%d,\"lines\":[{\"articleKey\":\"eggs_consumption\",\"articleSource\":\"INVENTORY\",\"quantity\":10,\"unitPriceXof\":3000}]}",
                    clientId)))
            .get("id")
            .asLong();
    postOk(base + "/orders/" + orderId + "/confirm", token, null);
    postOk(base + "/orders/" + orderId + "/start-preparation", token, null);
    return orderId;
  }

  private static String saleBody(long clientId, String articleKey, int qty, int price) {
    return String.format(
        "{\"clientId\":%d,\"paymentMethod\":\"CASH\",\"lines\":[{\"articleKey\":\"%s\",\"articleSource\":\"INVENTORY\",\"quantity\":%d,\"unitPriceXof\":%d}]}",
        clientId, articleKey, qty, price);
  }

  private static String saleBodyWithChannel(
      long clientId, String articleKey, int qty, int price, String salesChannelKey) {
    return String.format(
        "{\"clientId\":%d,\"paymentMethod\":\"CASH\",\"salesChannelKey\":\"%s\",\"lines\":[{\"articleKey\":\"%s\",\"articleSource\":\"INVENTORY\",\"quantity\":%d,\"unitPriceXof\":%d}]}",
        clientId, salesChannelKey, articleKey, qty, price);
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
