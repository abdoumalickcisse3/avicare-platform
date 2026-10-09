package com.avicare.tenancy;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.support.RsaKeys;
import java.security.KeyPair;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.ObjectMapper;

/**
 * One account, several farms, a different role in each — proved against a real PostgreSQL.
 *
 * <p>{@code user_farms} has always carried a role PER FARM, and both front-ends resolve permissions
 * from the membership matching the selected farm. But nobody had ever exercised it: on 2026-10-08
 * production held three multi-farm users and all three were OWNER on both sides. A capability
 * nothing tests is a capability nobody has checked.
 *
 * <p>Worse, the scenario was impossible to even set up through the API until this change: adding a
 * member whose email already had an account answered EMAIL_ALREADY_USED, so a farm owner could not
 * be made a manager of a neighbour's farm without a second account — and a second account is a
 * second dashboard, which is exactly what one must not need.
 *
 * <p>So this test walks the real thing: Awa owns her farm, Bintou adds Awa to hers as MANAGER, and
 * the server — not the screen — decides what Awa may do on each. The front-end gates are only ever
 * a convenience; the {@code @PreAuthorize} is the truth.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class MixedRoleAcrossFarmsIT {

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
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void anOwnerOfOneFarmCanBeAddedAsManagerOfAnother_onTheSameAccount() throws Exception {
    String awa = onboardOwner("mix-awa");
    createFarm(awa, "Ferme d'Awa");
    awa = relogin("mix-awa");

    String bintou = onboardOwner("mix-bintou");
    long bintousFarm = createFarm(bintou, "Ferme de Bintou");
    bintou = relogin("mix-bintou");

    // The geste that used to answer EMAIL_ALREADY_USED: adding someone who already has an account.
    // No temporary password comes back — Awa keeps the one she already uses.
    mockMvc
        .perform(
            post("/api/v1/farms/" + bintousFarm + "/users")
                .header("Authorization", "Bearer " + bintou)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"fullName\":\"Awa Diop\",\"email\":\"mix-awa@co.io\",\"role\":\"MANAGER\",\"phone\":\""
                        + nextTestPhone()
                        + "\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.temporaryPassword").doesNotExist());

    // Awa signs in once and sees BOTH farms: one account, one dashboard, a picker between them.
    awa = relogin("mix-awa");
    mockMvc
        .perform(get("/api/v1/farms").header("Authorization", "Bearer " + awa))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(2));
  }

  /**
   * The point of the whole exercise: one token, two farms, two different answers from the server.
   *
   * <p>The action has to be one only an OWNER may do. Hiring is NOT one — {@code POST
   * /farms/{id}/users} is granted to OWNER *and* MANAGER on purpose, which I had assumed otherwise
   * and had to check. Enabling a subscription module is owner-only, and costs nothing to undo.
   */
  @Test
  void theSameAccountIsOwnerOnOneFarmAndOnlyAManagerOnTheOther() throws Exception {
    String awa = onboardOwner("mix2-awa");
    long awasFarm = createFarm(awa, "Ferme d'Awa");

    String bintou = onboardOwner("mix2-bintou");
    long bintousFarm = createFarm(bintou, "Ferme de Bintou");
    bintou = relogin("mix2-bintou");
    attachAsManager(bintou, bintousFarm, "mix2-awa@co.io");

    // One sign-in, carrying both memberships.
    awa = relogin("mix2-awa");

    // Her own farm: OWNER, so she governs it.
    mockMvc
        .perform(
            post("/api/v1/farms/" + awasFarm + "/subscription/modules")
                .header("Authorization", "Bearer " + awa)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"moduleKey\":\"module.inventory\",\"mode\":\"HARD\"}"))
        .andExpect(status().isCreated());

    // Bintou's farm, SAME token: only a manager there, and a manager does not govern. A 201 here
    // would mean one farm's manager can reshape a neighbour's subscription.
    mockMvc
        .perform(
            post("/api/v1/farms/" + bintousFarm + "/subscription/modules")
                .header("Authorization", "Bearer " + awa)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"moduleKey\":\"module.inventory\",\"mode\":\"HARD\"}"))
        .andExpect(status().isForbidden());

    // And she is not locked out of Bintou's farm either — a manager still reads it.
    mockMvc
        .perform(
            get("/api/v1/farms/" + bintousFarm + "/users").header("Authorization", "Bearer " + awa))
        .andExpect(status().isOk());
  }

  @Test
  void aPersonCannotBeAddedTwiceToTheSameFarm() throws Exception {
    String bintou = onboardOwner("mix3-bintou");
    long farm = createFarm(bintou, "Ferme de Bintou");
    bintou = relogin("mix3-bintou");
    onboardOwner("mix3-awa");

    attachAsManager(bintou, farm, "mix3-awa@co.io");

    // The guard that was dead code until an existing account could be attached at all.
    mockMvc
        .perform(
            post("/api/v1/farms/" + farm + "/users")
                .header("Authorization", "Bearer " + bintou)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"fullName\":\"Awa\",\"email\":\"mix3-awa@co.io\",\"role\":\"FARMER\",\"phone\":\""
                        + nextTestPhone()
                        + "\"}"))
        .andExpect(status().isConflict());
  }

  // --- helpers (same shape as ModulePermissionIT) ------------------------------------------

  private void attachAsManager(String ownerToken, long farmId, String email) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/farms/" + farmId + "/users")
                .header("Authorization", "Bearer " + ownerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"fullName\":\"Membre\",\"email\":\""
                        + email
                        + "\",\"role\":\"MANAGER\",\"phone\":\""
                        + nextTestPhone()
                        + "\"}"))
        .andExpect(status().isCreated());
  }

  private String onboardOwner(String slug) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"email\":\""
                        + slug
                        + "@co.io\",\"password\":\"password123\",\"fullName\":\"Owner\",\"phone\":\""
                        + nextTestPhone()
                        + "\"}"))
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

  /**
   * A distinct number per CALL. Required since 2026-10-09, unique since V64 — a helper invoked
   * three times with one hard-coded number creates the first account and gets 409 on the second,
   * which is exactly what a literal did here before.
   */
  private static final java.util.concurrent.atomic.AtomicInteger PHONE_SEQ =
      new java.util.concurrent.atomic.AtomicInteger();

  private static String nextTestPhone() {
    return String.format("+2217%08d", PHONE_SEQ.incrementAndGet());
  }
}
