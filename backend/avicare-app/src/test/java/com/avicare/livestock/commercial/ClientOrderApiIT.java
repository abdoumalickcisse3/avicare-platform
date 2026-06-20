package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
 * End-to-end commercial REST — clients + orders (Sprint B5-5a) on a real PostgreSQL
 * (Testcontainers, V1–V23): owner happy path (client CRUD + order workflow), feature gating (403
 * without module.commercial.basic), RBAC (FARMER may create an order but not a client nor cancel
 * one) and cross-farm isolation (404). Gating FORCED ON. CI-only where Docker is unavailable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class ClientOrderApiIT {

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
  void ownerHappyPath_clientCrud_andOrderWorkflow() throws Exception {
    String owner = onboardOwner("co-happy");
    long farmId = createFarm(owner, "Ferme Commerciale");
    owner = relogin("co-happy");
    enableModule(owner, farmId, "module.commercial.basic");
    String base = "/api/v1/farms/" + farmId + "/commercial";

    // create + read clients
    JsonNode client =
        data(
            postOk(
                base + "/clients",
                owner,
                """
                {"clientType":"BUSINESS","displayName":"Ferme du Soleil","creditLimitXof":500000}
                """));
    long clientId = client.get("id").asLong();
    assertThat(client.get("currentBalanceXof").asLong()).isZero();
    assertThat(client.get("active").asBoolean()).isTrue();
    assertThat(data(getOk(base + "/clients", owner)).size()).isEqualTo(1);

    putOk(
        base + "/clients/" + clientId,
        owner,
        """
        {"clientType":"WHOLESALER","displayName":"Grossiste Soleil","creditLimitXof":1000000}
        """);
    assertThat(data(getOk(base + "/clients/" + clientId, owner)).get("clientType").asText())
        .isEqualTo("WHOLESALER");
    getOk(base + "/clients/over-credit-limit", owner); // 200, indicative list

    // order workflow PENDING -> CONFIRMED -> IN_PROGRESS, then cancel
    JsonNode order =
        data(
            postOk(
                base + "/orders",
                owner,
                String.format(
                    """
                    {"clientId":%d,"lines":[
                      {"articleKey":"eggs_consumption","articleSource":"INVENTORY","quantity":10,"unitPriceXof":3000}]}
                    """,
                    clientId)));
    long orderId = order.get("id").asLong();
    assertThat(order.get("status").asText()).isEqualTo("PENDING");
    assertThat(order.get("orderNumber").asText()).startsWith("ORD-");
    assertThat(order.get("totalXof").asLong()).isEqualTo(30_000L);

    assertThat(
            data(postOk(base + "/orders/" + orderId + "/confirm", owner, null))
                .get("status")
                .asText())
        .isEqualTo("CONFIRMED");
    assertThat(
            data(postOk(base + "/orders/" + orderId + "/start-preparation", owner, null))
                .get("status")
                .asText())
        .isEqualTo("IN_PROGRESS");
    assertThat(
            data(postOk(base + "/orders/" + orderId + "/cancel", owner, "{\"reason\":\"test\"}"))
                .get("status")
                .asText())
        .isEqualTo("CANCELLED");
  }

  @Test
  void commercialEndpoint_withoutModule_returns403() throws Exception {
    String owner = onboardOwner("co-gate");
    long farmId = createFarm(owner, "Ferme Sans Module");
    owner = relogin("co-gate");
    mockMvc
        .perform(
            get("/api/v1/farms/" + farmId + "/commercial/clients")
                .header("Authorization", "Bearer " + owner))
        .andExpect(status().isForbidden());
  }

  @Test
  void farmer_canCreateOrder_butNotClient_norCancel() throws Exception {
    String owner = onboardOwner("co-rbac");
    long farmId = createFarm(owner, "Ferme RBAC");
    owner = relogin("co-rbac");
    enableModule(owner, farmId, "module.commercial.basic");
    String base = "/api/v1/farms/" + farmId + "/commercial";

    long clientId =
        data(postOk(
                base + "/clients",
                owner,
                "{\"clientType\":\"INDIVIDUAL\",\"displayName\":\"Client\"}"))
            .get("id")
            .asLong();

    // A real FARMER: onboard the user, add them to the farm as FARMER, then log in so the token
    // carries the membership (created_by needs a real user id, so we can't forge a fake one).
    onboardOwner("co-farmer");
    addMember(owner, farmId, "co-farmer@co.io", "FARMER");
    String farmer = relogin("co-farmer");

    // FARMER may create an order (field op)
    JsonNode order =
        data(
            postOk(
                base + "/orders",
                farmer,
                String.format(
                    "{\"clientId\":%d,\"lines\":[{\"articleKey\":\"eggs_consumption\",\"articleSource\":\"INVENTORY\",\"quantity\":1,\"unitPriceXof\":3000}]}",
                    clientId)));
    long orderId = order.get("id").asLong();

    // FARMER may NOT create a client (supervisory) nor cancel an order (supervisory)
    mockMvc
        .perform(
            post(base + "/clients")
                .header("Authorization", "Bearer " + farmer)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"clientType\":\"INDIVIDUAL\",\"displayName\":\"X\"}"))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(
            post(base + "/orders/" + orderId + "/cancel")
                .header("Authorization", "Bearer " + farmer)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"no\"}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void crossFarm_client_returns404() throws Exception {
    String a = onboardOwner("co-fa");
    long farmA = createFarm(a, "Ferme A");
    a = relogin("co-fa");
    enableModule(a, farmA, "module.commercial.basic");
    long clientA =
        data(postOk(
                "/api/v1/farms/" + farmA + "/commercial/clients",
                a,
                "{\"clientType\":\"INDIVIDUAL\",\"displayName\":\"A\"}"))
            .get("id")
            .asLong();

    String b = onboardOwner("co-fb");
    long farmB = createFarm(b, "Ferme B");
    b = relogin("co-fb");
    enableModule(b, farmB, "module.commercial.basic");

    mockMvc
        .perform(
            get("/api/v1/farms/" + farmB + "/commercial/clients/" + clientA)
                .header("Authorization", "Bearer " + b))
        .andExpect(status().isNotFound());
  }

  // --- helpers --------------------------------------------------------

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

  private JsonNode putOk(String url, String token, String body) throws Exception {
    return read(
        mockMvc
            .perform(
                put(url)
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isOk()));
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
                        + "@co.io\",\"password\":\"password123\",\"fullName\":\"Owner\"}"))
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

  private void addMember(String ownerToken, long farmId, String email, String role)
      throws Exception {
    mockMvc
        .perform(
            post("/api/v1/farms/" + farmId + "/users")
                .header("Authorization", "Bearer " + ownerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"role\":\"" + role + "\"}"))
        .andExpect(status().isCreated());
  }
}
