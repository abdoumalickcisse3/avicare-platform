package com.avicare.tenancy;

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
 * End-to-end tenancy flow on a real PostgreSQL (Testcontainers): a user signs up, creates a farm
 * (becoming OWNER), then a fresh login carries the farm membership in the JWT so the protected farm
 * route is reachable; an invited member can read the farm after re-login. Proves the
 * MembershipProvider seam populates the token. CI-only on dev machines (Docker incompatibility).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@Testcontainers
class TenancyFlowIT {

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
  void createFarm_thenReloginCarriesMembership_andOwnerCanReadFarm() throws Exception {
    String ownerAccess = signupAndAccess("owner@farm.io", "password123", "Owner");

    // Create a farm -> caller becomes OWNER.
    String farmJson =
        mockMvc
            .perform(
                post("/api/v1/farms")
                    .header("Authorization", "Bearer " + ownerAccess)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Ferme Keur Massar\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    long farmId = objectMapper.readTree(farmJson).get("data").get("id").asLong();

    // The signup token had no memberships; a fresh login now embeds the OWNER membership.
    String ownerAccess2 = login("owner@farm.io", "password123");

    mockMvc
        .perform(get("/api/v1/farms/" + farmId).header("Authorization", "Bearer " + ownerAccess2))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.name").value("Ferme Keur Massar"));

    // Provision a second member, who then sees the farm after logging in with the temp password.
    String vetJson =
        mockMvc
            .perform(
                post("/api/v1/farms/" + farmId + "/users")
                    .header("Authorization", "Bearer " + ownerAccess2)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        "{\"fullName\":\"Vet\",\"email\":\"vet@farm.io\",\"role\":\"VETERINARIAN\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String vetPw = objectMapper.readTree(vetJson).get("data").get("temporaryPassword").asText();

    String vetAccess = login("vet@farm.io", vetPw);
    mockMvc
        .perform(get("/api/v1/farms/" + farmId).header("Authorization", "Bearer " + vetAccess))
        .andExpect(status().isOk());
  }

  @Test
  void farmYouAreNotMemberOf_isForbidden() throws Exception {
    String aAccess = signupAndAccess("a@farm.io", "password123", "A");
    String farmJson =
        mockMvc
            .perform(
                post("/api/v1/farms")
                    .header("Authorization", "Bearer " + aAccess)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"A Farm\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    long farmId = objectMapper.readTree(farmJson).get("data").get("id").asLong();

    String bAccess = signupAndAccess("b@farm.io", "password123", "B");
    mockMvc
        .perform(get("/api/v1/farms/" + farmId).header("Authorization", "Bearer " + bAccess))
        .andExpect(status().isForbidden());
  }

  private String signupAndAccess(String email, String password, String name) throws Exception {
    String body =
        "{\"email\":\""
            + email
            + "\",\"password\":\""
            + password
            + "\",\"fullName\":\""
            + name
            + "\"}";
    String json =
        mockMvc
            .perform(
                post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return objectMapper.readTree(json).get("data").get("accessToken").asText();
  }

  private String login(String email, String password) throws Exception {
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
