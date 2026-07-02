package com.avicare.tenancy;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.support.RsaKeys;
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
 * End-to-end member account provisioning on a real PostgreSQL (Testcontainers): an OWNER provisions
 * a member account (server creates the user + a temporary password), the member shows up in the
 * roster, OWNER cannot be assigned via provisioning, and unknown permissions are rejected. Also
 * covers password reset. CI-only on dev machines (Docker incompatibility).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class MemberAccountIT {

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
  void provisionMember_happyPath_thenAppearsInRoster_thenResetPassword() throws Exception {
    String owner = onboardOwner("ma-happy");
    long farmId = createFarm(owner, "Ferme Awa");
    owner = relogin("ma-happy");

    String json =
        mockMvc
            .perform(
                post("/api/v1/farms/" + farmId + "/users")
                    .header("Authorization", "Bearer " + owner)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {"fullName":"Awa Diop","email":"awa@ferme.io","phone":"+221770000000","role":"FARMER"}
                        """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.temporaryPassword").isNotEmpty())
            .andExpect(jsonPath("$.data.member.fullName").value("Awa Diop"))
            .andExpect(jsonPath("$.data.member.role").value("FARMER"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    long userId = objectMapper.readTree(json).get("data").get("member").get("userId").asLong();

    // Appears in the roster (which also contains the OWNER's own membership).
    mockMvc
        .perform(
            get("/api/v1/farms/" + farmId + "/users").header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[*].email", hasItem("awa@ferme.io")));

    // Reset password: a fresh temporary password is issued.
    mockMvc
        .perform(
            post("/api/v1/farms/" + farmId + "/users/" + userId + "/reset-password")
                .header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.temporaryPassword").isNotEmpty());
  }

  @Test
  void provisionMember_withOwnerRole_isRejected() throws Exception {
    String owner = onboardOwner("ma-owner");
    long farmId = createFarm(owner, "Ferme Owner");
    owner = relogin("ma-owner");

    mockMvc
        .perform(
            post("/api/v1/farms/" + farmId + "/users")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"fullName\":\"Fake Owner\",\"email\":\"fakeowner@ferme.io\",\"role\":\"OWNER\"}"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("OWNER_NOT_ASSIGNABLE"));
  }

  @Test
  void provisionMember_withUnknownPermission_isRejected() throws Exception {
    String owner = onboardOwner("ma-perm");
    long farmId = createFarm(owner, "Ferme Perm");
    owner = relogin("ma-perm");

    mockMvc
        .perform(
            post("/api/v1/farms/" + farmId + "/users")
                .header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"fullName":"Farmer Test","email":"farmer-perm@ferme.io","role":"FARMER","permissions":["poultry:read","bogus:write"]}
                    """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_PERMISSION"));
  }

  // --- helpers --------------------------------------------------------

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
}
